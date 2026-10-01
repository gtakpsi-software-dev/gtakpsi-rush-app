use crate::{
    handlers::handle_message,
    protocol::{send_outgoing_message, OutgoingMessage},
    state::{AppState, Client},
};
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        ConnectInfo, State,
    },
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use std::{net::SocketAddr, sync::Arc};
use tokio::sync::broadcast;

mod drag_lifecycle;

pub(crate) async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state, addr))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>, addr: SocketAddr) {
    let client_id = uuid::Uuid::new_v4().to_string();
    let (mut sender, mut receiver) = socket.split();

    let (tx, mut rx) = broadcast::channel::<String>(100);

    let mut global_rx = state.broadcast_tx.subscribe();

    // Connections remain viewers until their join message supplies a role.
    let client = Client {
        is_admin: false,
        name: None,
        tx: tx.clone(),
    };
    state.clients.insert(client_id.clone(), client);

    println!("Client connected: {} from {}", client_id, addr);

    broadcast_viewer_count(&state).await;

    drag_lifecycle::send_current_drags(&state, &tx).await;

    let send_task = tokio::spawn(async move {
        loop {
            tokio::select! {
                // Messages from global broadcast
                Ok(msg) = global_rx.recv() => {
                    if sender.send(Message::Text(msg)).await.is_err() {
                        break;
                    }
                }
                // Messages specifically for this client
                Ok(msg) = rx.recv() => {
                    if sender.send(Message::Text(msg)).await.is_err() {
                        break;
                    }
                }
            }
        }
    });

    let state_clone = state.clone();
    let client_id_clone = client_id.clone();

    while let Some(Ok(msg)) = receiver.next().await {
        if let Message::Text(text) = msg {
            handle_message(&text, &client_id_clone, &state_clone).await;
        }
    }

    send_task.abort();

    drag_lifecycle::release_client_drags(&state, &client_id).await;

    state.clients.remove(&client_id);
    println!("Client disconnected: {}", client_id);

    broadcast_viewer_count(&state).await;
}

pub(crate) async fn broadcast_viewer_count(state: &Arc<AppState>) {
    let count = state.clients.len();
    let msg = OutgoingMessage::ViewerCount { count };
    send_outgoing_message(&state.broadcast_tx, msg);
}
