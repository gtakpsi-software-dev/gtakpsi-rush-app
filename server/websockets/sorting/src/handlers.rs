use crate::{
    protocol::{send_outgoing_message, IncomingMessage, OutgoingMessage},
    state::AppState,
};
use std::sync::Arc;

mod drag;

fn joined_as_admin(state: &AppState, client_id: &str) -> bool {
    // Unjoined clients remain viewers until a join message supplies their role.
    state
        .clients
        .get(client_id)
        .map(|client| client.is_admin)
        .unwrap_or(false)
}

pub(crate) async fn handle_message(text: &str, client_id: &str, state: &Arc<AppState>) {
    let msg: Result<IncomingMessage, _> = serde_json::from_str(text);

    match msg {
        Ok(IncomingMessage::Join { is_admin, name }) => {
            if let Some(mut client) = state.clients.get_mut(client_id) {
                client.is_admin = is_admin;
                client.name = name.clone();
            }
            println!(
                "Client {} joined as admin={}, name={:?}",
                client_id, is_admin, name
            );
        }

        Ok(IncomingMessage::DragStart {
            rushee_id,
            rushee_name,
            x,
            y,
        }) => drag::start(state, client_id, rushee_id, rushee_name, x, y).await,

        Ok(IncomingMessage::DragMove { rushee_id, x, y }) => {
            drag::move_card(state, client_id, rushee_id, x, y).await;
        }

        Ok(IncomingMessage::DragEnd { rushee_id }) => {
            drag::end(state, client_id, rushee_id).await;
        }

        Ok(IncomingMessage::CardSaved {
            rushee_id,
            new_status,
        }) => {
            if !joined_as_admin(state, client_id) {
                return;
            }

            let msg = OutgoingMessage::CardMoved {
                rushee_id,
                new_status,
            };
            send_outgoing_message(&state.broadcast_tx, msg);
        }

        Err(e) => {
            println!("Failed to parse message: {} - {}", text, e);
        }
    }
}
