use super::websocket_support::{receive, send, TestServer};
use super::*;
use tokio_tungstenite::connect_async;

// Exercises drag snapshots, ownership conflicts, and release events over real sockets.
#[tokio::test]
async fn sockets_receive_drag_snapshots_conflicts_and_disconnect_releases() {
    let server = TestServer::start();
    let (mut owner, _) = connect_async(&server.url).await.unwrap();
    assert_eq!(
        receive(&mut owner).await,
        json!({"type": "viewer_count", "count": 1})
    );
    send(
        &mut owner,
        json!({"type": "join", "is_admin": true, "name": "First Admin"}),
    )
    .await;
    send(&mut owner, json!({"type": "drag_start", "rushee_id": "card", "rushee_name": "Test Rushee", "x": 12.5, "y": 30.0})).await;
    assert_eq!(
        receive(&mut owner).await,
        json!({"type": "drag_start", "dragger_name": "First Admin", "rushee_id": "card", "rushee_name": "Test Rushee", "x": 12.5, "y": 30.0})
    );

    let (mut other, _) = connect_async(&server.url).await.unwrap();
    // Snapshot and count use separate queues, so their relative arrival order is unspecified.
    let first = receive(&mut other).await;
    let second = receive(&mut other).await;
    let events = [first, second];
    assert!(events.contains(&json!({"type": "viewer_count", "count": 2})));
    assert!(events.contains(&json!({"type": "current_drag", "active": true, "dragger_name": "First Admin", "rushee_id": "card", "rushee_name": "Test Rushee", "x": 12.5, "y": 30.0})));
    assert_eq!(
        receive(&mut owner).await,
        json!({"type": "viewer_count", "count": 2})
    );

    send(
        &mut other,
        json!({"type": "join", "is_admin": true, "name": "Second Admin"}),
    )
    .await;
    send(&mut other, json!({"type": "drag_start", "rushee_id": "card", "rushee_name": "Test Rushee", "x": 0.0, "y": 0.0})).await;
    assert_eq!(
        receive(&mut other).await,
        json!({"type": "drag_denied", "rushee_id": "card", "dragger_name": "First Admin"})
    );

    owner.close(None).await.unwrap();
    assert_eq!(
        receive(&mut other).await,
        json!({"type": "drag_end", "rushee_id": "card"})
    );
    assert_eq!(
        receive(&mut other).await,
        json!({"type": "viewer_count", "count": 1})
    );
    other.close(None).await.unwrap();
}

// Checks that reconnecting clients can claim cards released by their old session.
#[tokio::test]
async fn reconnect_after_owner_disconnect_can_reacquire_the_released_card() {
    let server = TestServer::start();
    let (mut owner, _) = connect_async(&server.url).await.unwrap();
    assert_eq!(
        receive(&mut owner).await,
        json!({"type": "viewer_count", "count": 1})
    );
    send(
        &mut owner,
        json!({"type": "join", "is_admin": true, "name": "Admin"}),
    )
    .await;
    send(&mut owner, json!({"type": "drag_start", "rushee_id": "card", "rushee_name": "Test Rushee", "x": 1.0, "y": 2.0})).await;
    assert_eq!(receive(&mut owner).await["type"], "drag_start");

    let (mut observer, _) = connect_async(&server.url).await.unwrap();
    let initial = [receive(&mut observer).await, receive(&mut observer).await];
    assert!(initial.contains(&json!({"type": "viewer_count", "count": 2})));
    assert!(initial.contains(&json!({"type": "current_drag", "active": true, "dragger_name": "Admin", "rushee_id": "card", "rushee_name": "Test Rushee", "x": 1.0, "y": 2.0})));
    assert_eq!(
        receive(&mut owner).await,
        json!({"type": "viewer_count", "count": 2})
    );

    owner.close(None).await.unwrap();
    assert_eq!(
        receive(&mut observer).await,
        json!({"type": "drag_end", "rushee_id": "card"})
    );
    assert_eq!(
        receive(&mut observer).await,
        json!({"type": "viewer_count", "count": 1})
    );

    let (mut reconnected, _) = connect_async(&server.url).await.unwrap();
    assert_eq!(
        receive(&mut reconnected).await,
        json!({"type": "viewer_count", "count": 2})
    );
    assert_eq!(
        receive(&mut observer).await,
        json!({"type": "viewer_count", "count": 2})
    );
    send(
        &mut reconnected,
        json!({"type": "join", "is_admin": true, "name": "Admin"}),
    )
    .await;
    send(&mut reconnected, json!({"type": "drag_start", "rushee_id": "card", "rushee_name": "Test Rushee", "x": 3.0, "y": 4.0})).await;
    let restarted = json!({"type": "drag_start", "dragger_name": "Admin", "rushee_id": "card", "rushee_name": "Test Rushee", "x": 3.0, "y": 4.0});
    assert_eq!(receive(&mut reconnected).await, restarted);
    assert_eq!(receive(&mut observer).await, restarted);

    reconnected.close(None).await.unwrap();
    observer.close(None).await.unwrap();
}

// Checks that a demoted owner can finish a drag but cannot announce card saves.
#[tokio::test]
async fn role_change_preserves_drag_ownership_but_gates_new_save_broadcasts() {
    let server = TestServer::start();
    let (mut socket, _) = connect_async(&server.url).await.unwrap();
    assert_eq!(
        receive(&mut socket).await,
        json!({"type": "viewer_count", "count": 1})
    );

    send(
        &mut socket,
        json!({"type": "join", "is_admin": true, "name": "Admin"}),
    )
    .await;
    send(&mut socket, json!({"type": "drag_start", "rushee_id": "card", "rushee_name": "Test Rushee", "x": 1.0, "y": 2.0})).await;
    assert_eq!(receive(&mut socket).await["type"], "drag_start");

    send(&mut socket, json!({"type": "join", "is_admin": false})).await;
    send(
        &mut socket,
        json!({"type": "drag_move", "rushee_id": "card", "x": 3.0, "y": 4.0}),
    )
    .await;
    assert_eq!(
        receive(&mut socket).await,
        json!({"type": "drag_move", "rushee_id": "card", "x": 3.0, "y": 4.0})
    );
    send(
        &mut socket,
        json!({"type": "drag_end", "rushee_id": "card"}),
    )
    .await;
    assert_eq!(
        receive(&mut socket).await,
        json!({"type": "drag_end", "rushee_id": "card"})
    );

    send(
        &mut socket,
        json!({"type": "card_saved", "rushee_id": "ignored", "new_status": "IN_CLOUD"}),
    )
    .await;
    send(&mut socket, json!({"type": "join", "is_admin": true})).await;
    send(
        &mut socket,
        json!({"type": "card_saved", "rushee_id": "allowed", "new_status": "MID_CLOUD"}),
    )
    .await;
    assert_eq!(
        receive(&mut socket).await,
        json!({"type": "card_moved", "rushee_id": "allowed", "new_status": "MID_CLOUD"})
    );
    socket.close(None).await.unwrap();
}
