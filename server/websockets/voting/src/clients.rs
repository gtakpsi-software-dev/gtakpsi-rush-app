use axum::extract::ws::Message;
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::mpsc;

pub type ClientMap = Arc<DashMap<usize, mpsc::UnboundedSender<Message>>>;

// Queues a text event for every client and removes closed senders.
pub fn broadcast_to_clients(clients: &ClientMap, msg_str: String) {
    let mut to_remove = Vec::new();
    for entry in clients.iter() {
        let (id, tx) = entry.pair();
        if tx.send(Message::Text(msg_str.clone())).is_err() {
            to_remove.push(*id);
        }
    }

    for id in to_remove {
        clients.remove(&id);
        println!("🗑️ Removed disconnected client {id}");
    }
}
