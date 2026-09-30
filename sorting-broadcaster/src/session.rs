use crate::{
    handlers::handle_message,
    protocol::OutgoingMessage,
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

    // Create a channel for this client
    let (tx, mut rx) = broadcast::channel::<String>(100);

    // Subscribe to global broadcasts
    let mut global_rx = state.broadcast_tx.subscribe();

    // Add client to map (initially as viewer)
    let client = Client {
        id: client_id.clone(),
        is_admin: false,
        name: None,
        tx: tx.clone(),
    };
    state.clients.insert(client_id.clone(), client);

    println!("Client connected: {} from {}", client_id, addr);

    // Broadcast updated viewer count
    broadcast_viewer_count(&state).await;

    // Send current drag state to new client
    {
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
            if let Ok(json) = serde_json::to_string(&msg) {
                let _ = tx.send(json);
            }
        }
    }

    // Spawn task to forward messages to this client
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

    // Handle incoming messages
    let state_clone = state.clone();
    let client_id_clone = client_id.clone();

    while let Some(Ok(msg)) = receiver.next().await {
        if let Message::Text(text) = msg {
            handle_message(&text, &client_id_clone, &state_clone).await;
        }
    }

    // Cleanup on disconnect
    send_task.abort();

    // Check if this client was dragging
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
        if let Ok(json) = serde_json::to_string(&msg) {
            let _ = state.broadcast_tx.send(json);
        }
    }

    state.clients.remove(&client_id);
    println!("Client disconnected: {}", client_id);

    broadcast_viewer_count(&state).await;
}

pub(crate) async fn broadcast_viewer_count(state: &Arc<AppState>) {
    let count = state.clients.len();
    let msg = OutgoingMessage::ViewerCount { count };
    if let Ok(json) = serde_json::to_string(&msg) {
        let _ = state.broadcast_tx.send(json);
    }
}
