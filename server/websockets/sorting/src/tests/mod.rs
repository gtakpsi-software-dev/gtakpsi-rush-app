use crate::{
    handlers::handle_message,
    session::broadcast_viewer_count,
    state::{AppState, Client},
};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio::sync::broadcast::{error::TryRecvError, Receiver};

mod cleanup;
mod drag;
mod protocol;
mod websocket;
mod websocket_access;
mod websocket_support;

// Creates an empty board and a receiver for its broadcast events.
fn state() -> (Arc<AppState>, Receiver<String>) {
    let state = crate::state::new_state();
    let rx = state.broadcast_tx.subscribe();
    (state, rx)
}

// Registers a viewer fixture and returns its private event receiver.
fn add_client(state: &AppState, id: &str) -> Receiver<String> {
    let (tx, rx) = broadcast::channel(100);
    state.clients.insert(
        id.to_string(),
        Client {
            is_admin: false,
            name: None,
            tx,
        },
    );
    rx
}

// Dispatches a JSON fixture through the sorting message handler.
async fn send(state: &Arc<AppState>, client: &str, message: Value) {
    handle_message(&message.to_string(), client, state).await;
}

// Reads and decodes the next queued broadcast event.
fn receive(rx: &mut Receiver<String>) -> Value {
    serde_json::from_str(&rx.try_recv().expect("expected a broadcast")).unwrap()
}

// Checks that no event is queued for this receiver.
fn assert_empty(rx: &mut Receiver<String>) {
    assert!(matches!(rx.try_recv(), Err(TryRecvError::Empty)));
}

// Sends an admin join message for a registered test client.
async fn join_admin(state: &Arc<AppState>, id: &str, name: Option<&str>) {
    send(
        state,
        id,
        json!({"type": "join", "is_admin": true, "name": name}),
    )
    .await;
}

// Starts a test card drag at a fixed position.
async fn start_drag(state: &Arc<AppState>, client: &str, card: &str) {
    send(state, client, json!({"type": "drag_start", "rushee_id": card, "rushee_name": "Test Rushee", "x": 10.5, "y": -2.0})).await;
}
