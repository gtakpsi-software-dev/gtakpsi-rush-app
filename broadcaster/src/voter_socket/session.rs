use crate::clients::ClientList;
use crate::db::{get_redis_conn, reset_redis_conn, REDIS_CALL_TIMEOUT};
use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    extract::{ConnectInfo, Path},
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use redis::AsyncCommands;
use std::{
    net::SocketAddr,
    sync::atomic::{AtomicUsize, Ordering},
};
use tokio::sync::mpsc;

static NEXT_ID: AtomicUsize = AtomicUsize::new(1);

pub async fn ws_handler(
    Path(id): Path<String>,
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    clients: ClientList,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, addr, clients, Some(id)))
}

async fn handle_socket(
    socket: WebSocket,
    addr: SocketAddr,
    clients: ClientList,
    client_id: Option<String>,
) {
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
    match tokio::time::timeout(REDIS_CALL_TIMEOUT, conn.get::<_, Option<String>>("rushee")).await {
        Ok(Ok(Some(data))) => {
            let msg = serde_json::json!({
                "type": "rushee_update",
                "rushee": data
            });
            initial_messages.push(Message::Text(msg.to_string()));
        }
        Ok(Ok(None)) => {
            let msg = serde_json::json!({
                "type": "rushee_update",
                "rushee": null
            });
            initial_messages.push(Message::Text(msg.to_string()));
        }
        Ok(Err(e)) => {
            println!("❌ Redis error while fetching 'rushee': {e}");
        }
        Err(_) => {
            println!("❌ Redis timed out while fetching 'rushee', resetting connection");
            reset_redis_conn().await;
        }
    }

    // Initial question snapshot
    match tokio::time::timeout(
        REDIS_CALL_TIMEOUT,
        conn.get::<_, Option<String>>("question"),
    )
    .await
    {
        Ok(Ok(Some(data))) => {
            let msg = serde_json::json!({
                "type": "question_update",
                "question": data
            });
            initial_messages.push(Message::Text(msg.to_string()));
        }
        Ok(Ok(None)) => {
            let msg = serde_json::json!({
                "type": "question_update",
                "question": null
            });
            initial_messages.push(Message::Text(msg.to_string()));
        }
        Ok(Err(e)) => {
            println!("❌ Redis error while fetching 'question': {e}");
        }
        Err(_) => {
            println!("❌ Redis timed out while fetching 'question', resetting connection");
            reset_redis_conn().await;
        }
    }

    // Send all initial messages directly before registering
    for msg in initial_messages {
        if ws_sender.send(msg).await.is_err() {
            println!(
                "❌ Failed to send initial snapshot to client {}, aborting",
                id
            );
            return;
        }
    }

    // NOW register the client for future broadcasts
    clients.insert(id, tx.clone());
    println!("✅ Voter client {} registered for broadcasts", id);

    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sender.send(msg).await.is_err() {
                println!(
                    "❌ Failed to send to client {}, connection likely closed",
                    id
                );
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
