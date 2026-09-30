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
