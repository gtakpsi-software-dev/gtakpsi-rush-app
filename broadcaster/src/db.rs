use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use redis::PubSub;
use std::env;
use std::sync::Arc;
use tokio::sync::OnceCell;

pub static REDIS_CLIENT: OnceCell<Arc<ConnectionManager>> = OnceCell::const_new();

pub async fn get_redis_pubsub() -> redis::aio::PubSub {
    let url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string());
    let client = redis::Client::open(url).expect("Invalid Redis URL");
    let conn = client
        .get_async_connection()
        .await
        .expect("PubSub conn failed");
    conn.into_pubsub()
}

pub async fn get_redis_conn() -> Arc<ConnectionManager> {
    REDIS_CLIENT
        .get_or_init(|| async {
            let url =
                env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string());
            let client = redis::Client::open(url).expect("Invalid Redis URL");
            let manager = ConnectionManager::new(client)
                .await
                .expect("Failed to connect to Redis");
            Arc::new(manager)
        })
        .await
        .clone()
}
