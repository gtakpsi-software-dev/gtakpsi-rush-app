use crate::{
    protocol::{send_outgoing_message, OutgoingMessage},
    state::AppState,
};
use std::sync::Arc;
use tokio::sync::broadcast;

pub(super) async fn send_current_drags(state: &Arc<AppState>, tx: &broadcast::Sender<String>) {
    // New viewers need in-progress positions before processing their own messages.
    let drag = state.drag_state.read().await;
    for state in drag.values() {
        let msg = OutgoingMessage::CurrentDrag {
            active: true,
            dragger_name: Some(state.dragger_name.clone()),
            rushee_id: Some(state.rushee_id.clone()),
            rushee_name: Some(state.rushee_name.clone()),
            x: state.position_x,
            y: state.position_y,
        };
        send_outgoing_message(tx, msg);
    }
}

pub(super) async fn release_client_drags(state: &Arc<AppState>, client_id: &str) {
    // Release owned cards before removing the client so peers can acquire them on reconnect.
    let released = {
        let mut drag = state.drag_state.write().await;
        let released_ids: Vec<String> = drag
            .iter()
            .filter(|(_, state)| state.dragger_id == client_id)
            .map(|(id, _)| id.clone())
            .collect();
        for id in &released_ids {
            drag.remove(id);
        }
        released_ids
    };

    for rushee_id in released {
        let msg = OutgoingMessage::DragEnd { rushee_id };
        send_outgoing_message(&state.broadcast_tx, msg);
    }
}
