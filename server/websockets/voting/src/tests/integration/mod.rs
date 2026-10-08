use crate::{admin_socket, clients::ClientMap, voter_socket};
use dashmap::DashMap;
use futures_util::StreamExt;
use redis::{AsyncCommands, Value as RedisValue};
use serde_json::{json, Value};
use std::{env, net::SocketAddr, sync::Arc, time::Duration};
use tokio::net::TcpStream;
use tokio_tungstenite::{connect_async, tungstenite::Message, MaybeTlsStream, WebSocketStream};

mod websocket;

type TestSocket = WebSocketStream<MaybeTlsStream<TcpStream>>;

struct TestServer {
    url: String,
    admins: ClientMap,
    voters: ClientMap,
    task: tokio::task::JoinHandle<()>,
}

impl TestServer {
    // Starts a voting test server with separate admin and voter registries.
    fn start() -> Self {
        let admins = Arc::new(DashMap::new());
        let voters = Arc::new(DashMap::new());
        let app = crate::app::create_router(voters.clone(), admins.clone());
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
            url: format!("ws://{address}"),
            admins,
            voters,
            task,
        }
    }
}

impl Drop for TestServer {
    // Stops the test server when its fixture leaves scope.
    fn drop(&mut self) {
        self.task.abort();
    }
}

// Connects only after verifying the disposable Redis instance’s run marker.
async fn guarded_redis() -> redis::aio::Connection {
    let port = env::var("RUSH_TEST_REDIS_PORT").expect("use scripts/testing/voting-integration.py");
    let run_id = env::var("RUSH_TEST_REDIS_RUN_ID").expect("missing test instance marker");
    let url = format!("redis://127.0.0.1:{port}");
    assert_eq!(env::var("REDIS_URL").unwrap(), url);
    let client = redis::Client::open(url).unwrap();
    let mut conn = client.get_async_connection().await.unwrap();
    let marker: String = conn.get("_rush_voting_integration_guard").await.unwrap();
    assert_eq!(marker, run_id);
    conn
}

// Waits for both role listeners to subscribe before publishing test events.
async fn wait_for_subscribers(conn: &mut redis::aio::Connection) {
    tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            let counts: Vec<RedisValue> = redis::cmd("PUBSUB")
                .arg("NUMSUB")
                .arg("rushee")
                .arg("question")
                .arg("vote_channel")
                .query_async(conn)
                .await
                .unwrap();
            if matches!(
                (&counts[1], &counts[3], &counts[5]),
                (RedisValue::Int(2), RedisValue::Int(2), RedisValue::Int(1))
            ) {
                break;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .expect("voting subscribers did not connect");
}

// Waits up to five seconds for the next WebSocket frame.
async fn receive_frame(socket: &mut TestSocket) -> Message {
    let message = tokio::time::timeout(Duration::from_secs(5), socket.next())
        .await
        .expect("socket event timed out")
        .unwrap()
        .unwrap();
    message
}

// Decodes the next text frame as a JSON event.
async fn receive(socket: &mut TestSocket) -> Value {
    serde_json::from_str(receive_frame(socket).await.to_text().unwrap()).unwrap()
}

// Opens a test WebSocket connection to the supplied role URL.
async fn connect(url: &str) -> TestSocket {
    connect_async(url).await.unwrap().0
}
