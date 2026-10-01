use super::joined_as_admin;
use crate::{
    protocol::{send_outgoing_message, OutgoingMessage},
    state::{AppState, DragState},
};
use std::{sync::Arc, time::Instant};

async fn owns_drag(state: &AppState, client_id: &str, rushee_id: &str) -> bool {
    // A drag owner may finish moving after a role change; other clients cannot take it over.
    let drag = state.drag_state.read().await;
    drag.get(rushee_id)
        .map(|drag| drag.dragger_id == client_id)
        .unwrap_or(false)
}

pub(super) async fn start(
    state: &Arc<AppState>,
    client_id: &str,
    rushee_id: String,
    rushee_name: String,
    x: f64,
    y: f64,
) {
    if !joined_as_admin(state, client_id) {
        return;
    }

    // Deny competing owners directly so the current drag remains visible to everyone else.
    if let Some(existing) = state.drag_state.read().await.get(&rushee_id).cloned() {
        if existing.dragger_id != client_id {
            if let Some(client) = state.clients.get(client_id) {
                let msg = OutgoingMessage::DragDenied {
                    rushee_id,
                    dragger_name: existing.dragger_name,
                };
                send_outgoing_message(&client.tx, msg);
            }
            return;
        }
    }

    let dragger_name = state
        .clients
        .get(client_id)
        .and_then(|c| c.name.clone())
        .unwrap_or_else(|| "Admin".to_string());

    {
        let mut drag = state.drag_state.write().await;
        drag.insert(
            rushee_id.clone(),
            DragState {
                dragger_id: client_id.to_string(),
                dragger_name: dragger_name.clone(),
                rushee_id: rushee_id.clone(),
                rushee_name: rushee_name.clone(),
                position_x: x,
                position_y: y,
                last_update: Instant::now(),
            },
        );
    }

    let msg = OutgoingMessage::DragStart {
        dragger_name,
        rushee_id,
        rushee_name,
        x,
        y,
    };
    send_outgoing_message(&state.broadcast_tx, msg);
}

pub(super) async fn move_card(
    state: &Arc<AppState>,
    client_id: &str,
    rushee_id: String,
    x: f64,
    y: f64,
) {
    if !owns_drag(state, client_id, &rushee_id).await {
        return;
    }

    {
        let mut drag = state.drag_state.write().await;
        if let Some(state) = drag.get_mut(&rushee_id) {
            state.position_x = x;
            state.position_y = y;
            state.last_update = Instant::now();
        }
    }

    let msg = OutgoingMessage::DragMove { rushee_id, x, y };
    send_outgoing_message(&state.broadcast_tx, msg);
}

pub(super) async fn end(state: &Arc<AppState>, client_id: &str, rushee_id: String) {
    if !owns_drag(state, client_id, &rushee_id).await {
        return;
    }

    {
        let mut drag = state.drag_state.write().await;
        drag.remove(&rushee_id);
    }

    let msg = OutgoingMessage::DragEnd { rushee_id };
    send_outgoing_message(&state.broadcast_tx, msg);
}
