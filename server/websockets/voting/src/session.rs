use crate::clients::ClientMap;
use crate::db::get_redis_conn;
use crate::handlers::{handle_incoming_frames, SocketRole};
use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use redis::aio::ConnectionManager;
use std::{
    future::Future,
    net::SocketAddr,
    sync::atomic::{AtomicUsize, Ordering},
};
use tokio::sync::mpsc;

pub(crate) async fn handle_socket<F, Fut>(
    socket: WebSocket,
    addr: SocketAddr,
    clients: ClientMap,
    client_id: Option<String>,
    next_client_id: &'static AtomicUsize,
    role: SocketRole,
    load_initial_messages: F,
) where
    F: FnOnce(ConnectionManager) -> Fut + Send,
    Fut: Future<Output = Vec<Message>> + Send,
{
    println!("🔌 {} client connected from {addr}", role.label());

    let (mut ws_sender, ws_receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
    let id: usize = client_id
        .and_then(|s| s.parse().ok())
        .unwrap_or_else(|| next_client_id.fetch_add(1, Ordering::Relaxed));

    // INVARIANT: initial snapshots must reach the socket before it joins live broadcasts.
    // Registering first could deliver newer updates ahead of the older snapshot.
    let redis = get_redis_conn().await;
    let initial_messages = load_initial_messages(redis.as_ref().clone()).await;

    for msg in initial_messages {
        if ws_sender.send(msg).await.is_err() {
            println!("❌ Failed to send initial snapshot to client {id}, aborting");
            return;
        }
    }

    clients.insert(id, tx.clone());
    println!(
        "✅ {} client {} registered for broadcasts",
        role.label(),
        id
    );

    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sender.send(msg).await.is_err() {
                match role {
                    SocketRole::Admin => {
                        println!("Failed to send to client {id}, connection likely closed")
                    }
                    SocketRole::Voter => {
                        println!("❌ Failed to send to client {id}, connection likely closed")
                    }
                }
                break;
            }
        }
    });

    let recv_task = tokio::spawn(handle_incoming_frames(ws_receiver, tx.clone(), id, role));

    tokio::select! {
        _ = send_task => match role {
            SocketRole::Admin => println!("Send task completed for client {id}"),
            SocketRole::Voter => println!("📤 Send task completed for client {id}"),
        },
        _ = recv_task => match role {
            SocketRole::Admin => println!("Recv task completed for client {id}"),
            SocketRole::Voter => println!("📥 Connection monitoring completed for client {id}"),
        },
    }

    clients.remove(&id);
    println!("🔒 {} client {} disconnected", role.label(), id);
}
