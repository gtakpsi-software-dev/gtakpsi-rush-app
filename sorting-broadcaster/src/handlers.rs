use crate::{
    protocol::{IncomingMessage, OutgoingMessage},
    state::{AppState, DragState},
};
use std::{sync::Arc, time::Instant};

pub(crate) async fn handle_message(text: &str, client_id: &str, state: &Arc<AppState>) {
    let msg: Result<IncomingMessage, _> = serde_json::from_str(text);

    match msg {
        Ok(IncomingMessage::Join { is_admin, name }) => {
            // Update client info
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
        }) => {
            // Only admins can drag
            let is_admin = state
                .clients
                .get(client_id)
                .map(|c| c.is_admin)
                .unwrap_or(false);

            if !is_admin {
                return;
            }

            // Check if someone else is already dragging this card
            if let Some(existing) = state.drag_state.read().await.get(&rushee_id).cloned() {
                if existing.dragger_id != client_id {
                    if let Some(client) = state.clients.get(client_id) {
                        let msg = OutgoingMessage::DragDenied {
                            rushee_id,
                            dragger_name: existing.dragger_name,
                        };
                        if let Ok(json) = serde_json::to_string(&msg) {
                            let _ = client.tx.send(json);
                        }
                    }
                    return;
                }
            }

            let dragger_name = state
                .clients
                .get(client_id)
                .and_then(|c| c.name.clone())
                .unwrap_or_else(|| "Admin".to_string());

            // Update drag state for this rushee
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

            // Broadcast to all clients
            let msg = OutgoingMessage::DragStart {
                dragger_name,
                rushee_id,
                rushee_name,
                x,
                y,
            };
            if let Ok(json) = serde_json::to_string(&msg) {
                let _ = state.broadcast_tx.send(json);
            }
        }

        Ok(IncomingMessage::DragMove { rushee_id, x, y }) => {
            // Only the current dragger can send move updates
            let is_dragger = {
                let drag = state.drag_state.read().await;
                drag.get(&rushee_id)
                    .map(|state| state.dragger_id == client_id)
                    .unwrap_or(false)
            };

            if !is_dragger {
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
            if let Ok(json) = serde_json::to_string(&msg) {
                let _ = state.broadcast_tx.send(json);
            }
        }

        Ok(IncomingMessage::DragEnd { rushee_id }) => {
            // Only the current dragger can end
            let is_dragger = {
                let drag = state.drag_state.read().await;
                drag.get(&rushee_id)
                    .map(|state| state.dragger_id == client_id)
                    .unwrap_or(false)
            };

            if !is_dragger {
                return;
            }

            {
                let mut drag = state.drag_state.write().await;
                drag.remove(&rushee_id);
            }

            let msg = OutgoingMessage::DragEnd { rushee_id };
            if let Ok(json) = serde_json::to_string(&msg) {
                let _ = state.broadcast_tx.send(json);
            }
        }

        Ok(IncomingMessage::CardSaved {
            rushee_id,
            new_status,
        }) => {
            // Only admins can notify of saves
            let is_admin = state
                .clients
                .get(client_id)
                .map(|c| c.is_admin)
                .unwrap_or(false);

            if !is_admin {
                return;
            }

            let msg = OutgoingMessage::CardMoved {
                rushee_id,
                new_status,
            };
            if let Ok(json) = serde_json::to_string(&msg) {
                let _ = state.broadcast_tx.send(json);
            }
        }

        Err(e) => {
            println!("Failed to parse message: {} - {}", text, e);
        }
    }
}
