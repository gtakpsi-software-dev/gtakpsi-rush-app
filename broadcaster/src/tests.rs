use crate::clients::broadcast_to_clients;
use crate::pubsub::shared_update;
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

#[test]
fn shared_pubsub_channels_keep_string_payloads_and_wire_names() {
    assert_eq!(
        shared_update("rushee", r#"{"id":"one"}"#).as_deref(),
        Some(r#"{"rushee":"{\"id\":\"one\"}","type":"rushee_update"}"#)
    );
    assert_eq!(
        shared_update("question", "new question").as_deref(),
        Some(r#"{"question":"new question","type":"question_update"}"#)
    );
    assert_eq!(shared_update("vote_channel", "ignored"), None);
}
