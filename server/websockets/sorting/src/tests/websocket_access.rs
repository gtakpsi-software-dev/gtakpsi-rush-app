use super::websocket_support::{receive, send, TestServer};
use super::*;
use futures_util::SinkExt;
use tokio_tungstenite::{connect_async, tungstenite::Message};

// Verifies that save broadcasts use the client’s most recent join role.
#[tokio::test]
async fn card_saved_follows_the_latest_join_role() {
    let (state, mut broadcasts) = state();
    add_client(&state, "member");
    let saved = json!({
        "type": "card_saved", "rushee_id": "card", "new_status": "accepted"
    });
    let moved = json!({
        "type": "card_moved", "rushee_id": "card", "new_status": "accepted"
    });

    super::send(&state, "member", saved.clone()).await;
    assert_empty(&mut broadcasts);

    join_admin(&state, "member", Some("Admin")).await;
    super::send(&state, "member", saved.clone()).await;
    assert_eq!(super::receive(&mut broadcasts), moved);

    super::send(
        &state,
        "member",
        json!({"type": "join", "is_admin": false, "name": "Viewer"}),
    )
    .await;
    super::send(&state, "member", saved.clone()).await;
    assert_empty(&mut broadcasts);

    join_admin(&state, "member", Some("Admin Again")).await;
    super::send(&state, "member", saved).await;
    assert_eq!(super::receive(&mut broadcasts), moved);
}

// Checks that a connection remains usable after invalid JSON.
#[tokio::test]
async fn malformed_text_does_not_close_the_sorting_socket() {
    let server = TestServer::start();
    let (mut socket, _) = connect_async(&server.url).await.unwrap();
    assert_eq!(
        receive(&mut socket).await,
        json!({"type": "viewer_count", "count": 1})
    );

    socket
        .send(Message::Text("not-json".to_owned()))
        .await
        .unwrap();
    send(
        &mut socket,
        json!({"type": "join", "is_admin": true, "name": "Admin"}),
    )
    .await;
    send(
        &mut socket,
        json!({"type": "card_saved", "rushee_id": "card", "new_status": "accepted"}),
    )
    .await;

    assert_eq!(
        receive(&mut socket).await,
        json!({"type": "card_moved", "rushee_id": "card", "new_status": "accepted"})
    );
    socket.close(None).await.unwrap();
}

// Checks that ignored binary frames do not interrupt later text messages.
#[tokio::test]
async fn binary_frames_do_not_close_the_sorting_socket() {
    let server = TestServer::start();
    let (mut socket, _) = connect_async(&server.url).await.unwrap();
    assert_eq!(
        receive(&mut socket).await,
        json!({"type": "viewer_count", "count": 1})
    );

    socket.send(Message::Binary(vec![0, 1, 2])).await.unwrap();
    send(
        &mut socket,
        json!({"type": "join", "is_admin": true, "name": "Admin"}),
    )
    .await;
    send(
        &mut socket,
        json!({"type": "card_saved", "rushee_id": "card", "new_status": "accepted"}),
    )
    .await;

    assert_eq!(
        receive(&mut socket).await,
        json!({"type": "card_moved", "rushee_id": "card", "new_status": "accepted"})
    );
    socket.close(None).await.unwrap();
}

// Verifies viewer restrictions through the WebSocket transport.
#[tokio::test]
async fn viewer_messages_do_not_claim_cards_or_emit_save_events() {
    let server = TestServer::start();
    let (mut viewer, _) = connect_async(&server.url).await.unwrap();
    assert_eq!(
        receive(&mut viewer).await,
        json!({"type": "viewer_count", "count": 1})
    );

    // A connected socket remains a viewer until a join message grants admin access.
    send(&mut viewer, json!({"type": "drag_start", "rushee_id": "card", "rushee_name": "Test Rushee", "x": 1.0, "y": 2.0})).await;
    send(
        &mut viewer,
        json!({"type": "card_saved", "rushee_id": "card", "new_status": "accepted"}),
    )
    .await;
    send(
        &mut viewer,
        json!({"type": "join", "is_admin": false, "name": "Viewer"}),
    )
    .await;
    send(&mut viewer, json!({"type": "drag_start", "rushee_id": "card", "rushee_name": "Test Rushee", "x": 3.0, "y": 4.0})).await;
    send(
        &mut viewer,
        json!({"type": "card_saved", "rushee_id": "card", "new_status": "accepted"}),
    )
    .await;

    let (mut admin, _) = connect_async(&server.url).await.unwrap();
    assert_eq!(
        receive(&mut admin).await,
        json!({"type": "viewer_count", "count": 2})
    );
    assert_eq!(
        receive(&mut viewer).await,
        json!({"type": "viewer_count", "count": 2})
    );

    send(
        &mut admin,
        json!({"type": "join", "is_admin": true, "name": "Admin"}),
    )
    .await;
    send(&mut admin, json!({"type": "drag_start", "rushee_id": "card", "rushee_name": "Test Rushee", "x": 5.0, "y": 6.0})).await;
    let started = json!({"type": "drag_start", "dragger_name": "Admin", "rushee_id": "card", "rushee_name": "Test Rushee", "x": 5.0, "y": 6.0});
    assert_eq!(receive(&mut admin).await, started);
    assert_eq!(receive(&mut viewer).await, started);

    send(
        &mut admin,
        json!({"type": "card_saved", "rushee_id": "card", "new_status": "accepted"}),
    )
    .await;
    let saved = json!({"type": "card_moved", "rushee_id": "card", "new_status": "accepted"});
    assert_eq!(receive(&mut admin).await, saved);
    assert_eq!(receive(&mut viewer).await, saved);

    admin.close(None).await.unwrap();
    assert_eq!(
        receive(&mut viewer).await,
        json!({"type": "drag_end", "rushee_id": "card"})
    );
    assert_eq!(
        receive(&mut viewer).await,
        json!({"type": "viewer_count", "count": 1})
    );
    viewer.close(None).await.unwrap();
}
