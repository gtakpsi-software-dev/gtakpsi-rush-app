use crate::{admin_socket, voter_socket};
use axum::extract::ws::Message;
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::mpsc;

#[test]
fn both_broadcast_paths_deliver_text_and_prune_closed_receivers() {
    for broadcast in [
        admin_socket::broadcast_to_clients,
        voter_socket::broadcast_to_clients,
    ] {
        let clients = Arc::new(DashMap::new());
        let (live_sender, mut live_receiver) = mpsc::unbounded_channel();
        let (closed_sender, closed_receiver) = mpsc::unbounded_channel();
        drop(closed_receiver);
        clients.insert(41, live_sender);
        clients.insert(42, closed_sender);

        broadcast(&clients, "first".to_string());
        assert!(matches!(live_receiver.try_recv(), Ok(Message::Text(text)) if text == "first"));
        assert!(clients.contains_key(&41));
        assert!(!clients.contains_key(&42));

        broadcast(&clients, "second".to_string());
        assert!(matches!(live_receiver.try_recv(), Ok(Message::Text(text)) if text == "second"));
        assert!(live_receiver.try_recv().is_err());
    }
}
