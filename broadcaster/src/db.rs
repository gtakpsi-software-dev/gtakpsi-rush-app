use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use redis::PubSub;
use std::env;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

/// How long we'll wait on a single Redis command (via the shared connection
/// manager) before giving up on it. redis-rs's ConnectionManager has been
/// observed to wedge indefinitely (rather than erroring) after the
/// underlying TCP connection is silently dropped by a proxy — without a
/// timeout, that hangs every websocket handler forever with no recovery.
pub const REDIS_CALL_TIMEOUT: Duration = Duration::from_secs(3);

static REDIS_CLIENT: RwLock<Option<Arc<ConnectionManager>>> = RwLock::const_new(None);

fn redis_url() -> String {
    env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string())
}

pub async fn get_redis_pubsub() -> redis::aio::PubSub {
    let client = redis::Client::open(redis_url()).expect("Invalid Redis URL");
    let conn = client
        .get_async_connection()
        .await
        .expect("PubSub conn failed");
    conn.into_pubsub()
}

/// Returns the shared Redis connection manager, creating it on first use.
pub async fn get_redis_conn() -> Arc<ConnectionManager> {
    if let Some(conn) = REDIS_CLIENT.read().await.as_ref() {
        return conn.clone();
    }

    let mut guard = REDIS_CLIENT.write().await;
    if let Some(conn) = guard.as_ref() {
        return conn.clone();
    }

    let client = redis::Client::open(redis_url()).expect("Invalid Redis URL");
    let manager = ConnectionManager::new(client)
        .await
        .expect("Failed to connect to Redis");
    let conn = Arc::new(manager);
    *guard = Some(conn.clone());
    conn
}

/// Drops the cached connection manager so the next `get_redis_conn()` call
/// builds a fresh one. Call this after a command on the shared connection
/// times out, since a wedged ConnectionManager otherwise never recovers on
/// its own.
pub async fn reset_redis_conn() {
    *REDIS_CLIENT.write().await = None;
}
