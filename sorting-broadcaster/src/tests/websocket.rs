use super::*;
use futures_util::{SinkExt, StreamExt};
use std::{net::SocketAddr, time::Duration};
use tokio::net::TcpStream;
use tokio_tungstenite::{connect_async, tungstenite::Message, MaybeTlsStream, WebSocketStream};

type TestSocket = WebSocketStream<MaybeTlsStream<TcpStream>>;

struct TestServer {
    url: String,
    task: tokio::task::JoinHandle<()>,
}

impl TestServer {
    fn start() -> Self {
        let (state, _) = state();
        let app = crate::app::create_router(state);
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let address = listener.local_addr().unwrap();
        let task = tokio::spawn(async move {
            axum::Server::from_tcp(listener)
                .unwrap()
                .serve(app.into_make_service_with_connect_info::<SocketAddr>())
                .await
                .unwrap();
        });
        Self {
            url: format!("ws://{address}/ws"),
            task,
        }
    }
}

impl Drop for TestServer {
    fn drop(&mut self) {
        self.task.abort();
    }
}

async fn receive(socket: &mut TestSocket) -> Value {
    // Bound network waits so a missing protocol event fails instead of hanging CI.
    let message = tokio::time::timeout(Duration::from_secs(5), socket.next())
        .await
        .expect("timed out waiting for socket event")
        .unwrap()
        .unwrap();
    serde_json::from_str(message.to_text().unwrap()).unwrap()
}

async fn send(socket: &mut TestSocket, message: Value) {
    socket
        .send(Message::Text(message.to_string()))
        .await
        .unwrap();
}

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
