use crate::db::{reset_redis_conn, REDIS_CALL_TIMEOUT};
use axum::extract::ws::Message;
use redis::{aio::ConnectionManager, AsyncCommands};

pub(super) async fn load_initial_messages(mut conn: ConnectionManager) -> Vec<Message> {
    // Collect initial messages to send
    let mut initial_messages = Vec::new();

    // Initial rushee snapshot
    match tokio::time::timeout(REDIS_CALL_TIMEOUT, conn.get::<_, Option<String>>("rushee")).await {
        Ok(Ok(Some(data))) => {
            let msg = serde_json::json!({
                "type": "rushee_update",
                "rushee": data
            });
            initial_messages.push(Message::Text(msg.to_string()));
        }
        Ok(Ok(None)) => {
            let msg = serde_json::json!({
                "type": "rushee_update",
                "rushee": null
            });
            initial_messages.push(Message::Text(msg.to_string()));
        }
        Ok(Err(e)) => {
            println!("❌ Redis error while fetching 'rushee': {e}");
        }
        Err(_) => {
            println!("❌ Redis timed out while fetching 'rushee', resetting connection");
            reset_redis_conn().await;
        }
    }

    // Initial question snapshot
    match tokio::time::timeout(
        REDIS_CALL_TIMEOUT,
        conn.get::<_, Option<String>>("question"),
    )
    .await
    {
        Ok(Ok(Some(data))) => {
            let msg = serde_json::json!({
                "type": "question_update",
                "question": data
            });
            initial_messages.push(Message::Text(msg.to_string()));
        }
        Ok(Ok(None)) => {
            let msg = serde_json::json!({
                "type": "question_update",
                "question": null
            });
            initial_messages.push(Message::Text(msg.to_string()));
        }
        Ok(Err(e)) => {
            println!("❌ Redis error while fetching 'question': {e}");
        }
        Err(_) => {
            println!("❌ Redis timed out while fetching 'question', resetting connection");
            reset_redis_conn().await;
        }
    }
    initial_messages
}
