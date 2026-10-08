use super::*;

// Checks join metadata updates and counts admins among connected viewers.
#[tokio::test]
async fn joins_update_existing_clients_and_viewer_count_includes_admins() {
    let (state, mut broadcasts) = state();
    let mut direct = add_client(&state, "first");
    add_client(&state, "second");
    join_admin(&state, "first", Some("Test Admin")).await;
    join_admin(&state, "missing", None).await;

    let client = state.clients.get("first").unwrap();
    assert!(client.is_admin);
    assert_eq!(client.name.as_deref(), Some("Test Admin"));
    drop(client);
    assert_eq!(state.clients.len(), 2);
    assert_empty(&mut broadcasts);
    assert_empty(&mut direct);
    broadcast_viewer_count(&state).await;
    assert_eq!(
        receive(&mut broadcasts),
        json!({"type": "viewer_count", "count": 2})
    );
}

// Verifies that invalid messages leave the board and broadcast channel untouched.
#[tokio::test]
async fn malformed_and_unknown_messages_do_not_change_state_or_emit_events() {
    let (state, mut broadcasts) = state();
    let mut direct = add_client(&state, "viewer");
    for text in [
        "not json",
        r#"{"type":"unknown"}"#,
        r#"{"type":"join"}"#,
        r#"{"type":"drag_start","rushee_id":"card"}"#,
    ] {
        handle_message(text, "viewer", &state).await;
    }
    assert!(!state.clients.get("viewer").unwrap().is_admin);
    assert!(state.drag_state.read().await.is_empty());
    assert_empty(&mut broadcasts);
    assert_empty(&mut direct);
}

// Checks that viewer messages cannot claim cards or announce saved moves.
#[tokio::test]
async fn viewers_cannot_start_drags_or_notify_card_saves() {
    let (state, mut broadcasts) = state();
    add_client(&state, "viewer");
    for client in ["viewer", "missing"] {
        start_drag(&state, client, "card").await;
        send(
            &state,
            client,
            json!({"type": "card_saved", "rushee_id": "card", "new_status": "accepted"}),
        )
        .await;
    }
    assert!(state.drag_state.read().await.is_empty());
    assert_empty(&mut broadcasts);
}

// Verifies that save notifications preserve status text and retain active drags.
#[tokio::test]
async fn admin_saved_notifications_preserve_status_verbatim_without_releasing_drag() {
    let (state, mut broadcasts) = state();
    add_client(&state, "admin");
    join_admin(&state, "admin", None).await;
    start_drag(&state, "admin", "card").await;
    receive(&mut broadcasts);

    // The socket relays the save notification; status validation belongs to the HTTP API.
    send(
        &state,
        "admin",
        json!({"type": "card_saved", "rushee_id": "card", "new_status": "legacy-status"}),
    )
    .await;
    assert_eq!(
        receive(&mut broadcasts),
        json!({"type": "card_moved", "rushee_id": "card", "new_status": "legacy-status"})
    );
    assert!(state.drag_state.read().await.contains_key("card"));
}
