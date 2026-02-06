use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    extract::ConnectInfo,
    response::IntoResponse,
};
use axum::extract::Path;
use dashmap::DashMap;
use redis::AsyncCommands;
use std::{net::SocketAddr, sync::Arc, time::Duration};
use tokio::sync::mpsc;
use crate::db::{get_redis_conn, get_redis_pubsub};
use futures_util::{SinkExt, StreamExt};

use std::sync::atomic::{AtomicUsize, Ordering};
static NEXT_ID: AtomicUsize = AtomicUsize::new(1);

pub type ClientList = Arc<DashMap<usize, mpsc::UnboundedSender<Message>>>;

pub async fn ws_handler(
    Path(id): Path<String>,
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    clients: ClientList,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, addr, clients, Some(id)))
}

/// Background task that listens to Redis pubsub channels and pushes updates to clients
/// Includes automatic reconnection on failure
pub async fn spawn_pubsub_listener(clients: ClientList) {
    tokio::spawn(async move {
        loop {
            println!("🔄 Voter PubSub: Connecting to Redis...");
            
            match run_voter_pubsub_listener(clients.clone()).await {
                Ok(_) => {
                    println!("⚠️ Voter PubSub: Stream ended unexpectedly, reconnecting...");
                }
                Err(e) => {
                    println!("❌ Voter PubSub error: {}, reconnecting in 3s...", e);
                }
            }
            
            // Wait before reconnecting
            tokio::time::sleep(Duration::from_secs(3)).await;
        }
    });
}

/// Inner function that runs the pubsub listener (can return error for retry)
async fn run_voter_pubsub_listener(clients: ClientList) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut pubsub = get_redis_pubsub().await;
    
    pubsub.subscribe("rushee").await?;
    pubsub.subscribe("question").await?;
    
    println!("✅ Voter PubSub: Connected and subscribed to channels");

    let mut stream = pubsub.on_message();
    while let Some(msg) = stream.next().await {
        let channel = msg.get_channel_name().to_string();
        if let Ok(payload) = msg.get_payload::<String>() {
            let msg = match channel.as_str() {
                "rushee" => serde_json::json!({
                    "type": "rushee_update",
                    "rushee": payload
                }),
                "question" => serde_json::json!({
                    "type": "question_update",
                    "question": payload
                }),
                _ => continue,
            };
            broadcast_to_clients(&clients, msg.to_string());
        }
    }
    
    Ok(())
}

fn broadcast_to_clients(clients: &ClientList, msg_str: String) {
    let mut to_remove = Vec::new();
    for entry in clients.iter() {
        let (id, tx) = entry.pair();
        if tx.send(Message::Text(msg_str.clone())).is_err() {
            to_remove.push(*id);
        }
    }

    for id in to_remove {
        clients.remove(&id);
        println!("🗑️ Removed disconnected client {}", id);
    }
}

async fn handle_socket(socket: WebSocket, addr: SocketAddr, clients: ClientList, client_id: Option<String>) {
    println!("🔌 Voter client connected from {}", addr);

    let (mut ws_sender, mut ws_receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
    let id: usize = client_id
        .and_then(|s| s.parse().ok())
        .unwrap_or_else(|| NEXT_ID.fetch_add(1, Ordering::Relaxed));

    // IMPORTANT: Send initial snapshots BEFORE registering client
    // This prevents race conditions where updates arrive before initial state
    let redis = get_redis_conn().await;
    let mut conn = (*redis).clone();

    // Collect initial messages to send
    let mut initial_messages = Vec::new();

    // Initial rushee snapshot
    match conn.get::<_, Option<String>>("rushee").await {
        Ok(Some(data)) => {
            let msg = serde_json::json!({
                "type": "rushee_update",
                "rushee": data
            });
            initial_messages.push(Message::Text(msg.to_string()));
        }
        Ok(None) => {
            let msg = serde_json::json!({
                "type": "rushee_update",
                "rushee": null
            });
            initial_messages.push(Message::Text(msg.to_string()));
        }
        Err(e) => {
            println!("❌ Redis error while fetching 'rushee': {e}");
        }
    }

    // Initial question snapshot
    match conn.get::<_, Option<String>>("question").await {
        Ok(Some(data)) => {
            let msg = serde_json::json!({
                "type": "question_update",
                "question": data
            });
            initial_messages.push(Message::Text(msg.to_string()));
        }
        Ok(None) => {
            let msg = serde_json::json!({
                "type": "question_update",
                "question": null
            });
            initial_messages.push(Message::Text(msg.to_string()));
        }
        Err(e) => {
            println!("❌ Redis error while fetching 'question': {e}");
        }
    }

    // Send all initial messages directly before registering
    for msg in initial_messages {
        if ws_sender.send(msg).await.is_err() {
            println!("❌ Failed to send initial snapshot to client {}, aborting", id);
            return;
        }
    }

    // NOW register the client for future broadcasts
    clients.insert(id, tx.clone());
    println!("✅ Voter client {} registered for broadcasts", id);

    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sender.send(msg).await.is_err() {
                println!("❌ Failed to send to client {}, connection likely closed", id);
                break;
            }
        }
    });

    // Clone tx for ping responses
    let tx_for_pong = tx.clone();

    let recv_task = tokio::spawn(async move {
        while let Some(msg) = ws_receiver.next().await {
            match msg {
                Ok(Message::Close(_)) => {
                    println!("🔒 Client {} sent close message", id);
                    break;
                }
                Ok(Message::Ping(data)) => {
                    // Respond to ping with pong
                    if tx_for_pong.send(Message::Pong(data)).is_err() {
                        println!("Failed to send pong to client {}", id);
                        break;
                    }
                }
                Ok(Message::Text(_)) | Ok(Message::Binary(_)) => {}
                Ok(Message::Pong(_)) => {}
                Err(e) => {
                    println!("❌ WebSocket error for client {}: {}", id, e);
                    break;
                }
            }
        }
    });

    tokio::select! {
        _ = send_task => {
            println!("📤 Send task completed for client {}", id);
        },
        _ = recv_task => {
            println!("📥 Connection monitoring completed for client {}", id);
        },
    }

    clients.remove(&id);
    println!("🔒 Voter client {} disconnected", id);
}
