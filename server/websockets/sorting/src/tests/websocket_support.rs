use super::{state, Value};
use futures_util::{SinkExt, StreamExt};
use std::{net::SocketAddr, time::Duration};
use tokio::net::TcpStream;
use tokio_tungstenite::{tungstenite::Message, MaybeTlsStream, WebSocketStream};

pub(super) type TestSocket = WebSocketStream<MaybeTlsStream<TcpStream>>;

pub(super) struct TestServer {
    pub(super) url: String,
    task: tokio::task::JoinHandle<()>,
}

impl TestServer {
    pub(super) fn start() -> Self {
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

pub(super) async fn receive(socket: &mut TestSocket) -> Value {
    // Bound network waits so a missing protocol event fails instead of hanging CI.
    let message = tokio::time::timeout(Duration::from_secs(5), socket.next())
        .await
        .expect("timed out waiting for socket event")
        .unwrap()
        .unwrap();
    serde_json::from_str(message.to_text().unwrap()).unwrap()
}

pub(super) async fn send(socket: &mut TestSocket, message: Value) {
    socket
        .send(Message::Text(message.to_string()))
        .await
        .unwrap();
}
