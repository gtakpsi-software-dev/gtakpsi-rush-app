use crate::clients::broadcast_to_clients;
use axum::extract::ws::Message;
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::mpsc;

#[test]
fn broadcasts_deliver_text_and_prune_closed_receivers() {
    let clients = Arc::new(DashMap::new());
    let (live_sender, mut live_receiver) = mpsc::unbounded_channel();
    let (closed_sender, closed_receiver) = mpsc::unbounded_channel();
    drop(closed_receiver);
    clients.insert(41, live_sender);
    clients.insert(42, closed_sender);

    broadcast_to_clients(&clients, "first".to_string());
    assert!(matches!(live_receiver.try_recv(), Ok(Message::Text(text)) if text == "first"));
    assert!(clients.contains_key(&41));
    assert!(!clients.contains_key(&42));

    broadcast_to_clients(&clients, "second".to_string());
    assert!(matches!(live_receiver.try_recv(), Ok(Message::Text(text)) if text == "second"));
    assert!(live_receiver.try_recv().is_err());
}
