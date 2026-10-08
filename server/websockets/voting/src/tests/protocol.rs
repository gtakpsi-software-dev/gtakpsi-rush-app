use crate::clients::broadcast_to_clients;
use crate::protocol::{shared_update, vote_update};
use axum::extract::ws::Message;
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::mpsc;

// Checks that broadcasts reach live clients and remove disconnected receivers.
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

// Checks rushee and question event names and preserves their string payloads.
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

// Checks that malformed stored votes are omitted without losing valid entries.
#[test]
fn vote_events_keep_valid_json_values_and_skip_malformed_hash_entries() {
    assert_eq!(
        vote_update(vec![
            r#"{"choice":"yes"}"#.into(),
            "not json".into(),
            "null".into(),
        ]),
        r#"{"type":"vote_update","votes":[{"choice":"yes"},null]}"#
    );
    assert_eq!(
        vote_update(vec!["invalid".into()]),
        r#"{"type":"vote_update","votes":[]}"#
    );
}
