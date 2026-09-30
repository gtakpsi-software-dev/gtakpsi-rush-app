use crate::{
    handlers::handle_message,
    session::broadcast_viewer_count,
    state::{AppState, Client},
};
use dashmap::DashMap;
use serde_json::{json, Value};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::broadcast;
use tokio::sync::broadcast::{error::TryRecvError, Receiver};

mod drag;
mod protocol;
mod websocket;

fn state() -> (Arc<AppState>, Receiver<String>) {
    let (broadcast_tx, rx) = broadcast::channel(1000);
    (
        Arc::new(AppState {
            clients: Arc::new(DashMap::new()),
            drag_state: Arc::new(tokio::sync::RwLock::new(HashMap::new())),
            broadcast_tx,
        }),
        rx,
    )
}

fn add_client(state: &AppState, id: &str) -> Receiver<String> {
    let (tx, rx) = broadcast::channel(100);
    state.clients.insert(
        id.to_string(),
        Client {
            id: id.to_string(),
            is_admin: false,
            name: None,
            tx,
        },
    );
    rx
}

async fn send(state: &Arc<AppState>, client: &str, message: Value) {
    handle_message(&message.to_string(), client, state).await;
}

fn receive(rx: &mut Receiver<String>) -> Value {
    serde_json::from_str(&rx.try_recv().expect("expected a broadcast")).unwrap()
}

fn assert_empty(rx: &mut Receiver<String>) {
    assert!(matches!(rx.try_recv(), Err(TryRecvError::Empty)));
}

async fn join_admin(state: &Arc<AppState>, id: &str, name: Option<&str>) {
    send(
        state,
        id,
        json!({"type": "join", "is_admin": true, "name": name}),
    )
    .await;
}

async fn start_drag(state: &Arc<AppState>, client: &str, card: &str) {
    send(state, client, json!({"type": "drag_start", "rushee_id": card, "rushee_name": "Test Rushee", "x": 10.5, "y": -2.0})).await;
}
