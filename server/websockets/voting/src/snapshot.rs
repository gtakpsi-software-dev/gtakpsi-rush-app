use crate::db::{reset_redis_conn, REDIS_CALL_TIMEOUT};
use axum::extract::ws::Message;
use redis::{aio::ConnectionManager, AsyncCommands};
use serde_json::{Map, Value};

pub async fn load_field(
    conn: &mut ConnectionManager,
    key: &'static str,
    logged_key: &str,
) -> Option<Message> {
    match tokio::time::timeout(REDIS_CALL_TIMEOUT, conn.get::<_, Option<String>>(key)).await {
        Ok(Ok(data)) => {
            // Preserve the stored JSON as text inside the event envelope for existing clients.
            let mut event = Map::new();
            event.insert("type".into(), Value::String(format!("{key}_update")));
            event.insert(key.into(), data.map(Value::String).unwrap_or(Value::Null));
            Some(Message::Text(Value::Object(event).to_string()))
        }
        Ok(Err(error)) => {
            println!("❌ Redis error while fetching {logged_key}: {error}");
            None
        }
        Err(_) => {
            println!("❌ Redis timed out while fetching {logged_key}, resetting connection");
            reset_redis_conn().await;
            None
        }
    }
}
