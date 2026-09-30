use crate::db::{reset_redis_conn, REDIS_CALL_TIMEOUT};
use axum::extract::ws::Message;
use redis::{aio::ConnectionManager, AsyncCommands};

pub(super) async fn load_initial_messages(mut conn: ConnectionManager) -> Vec<Message> {
    let mut initial_messages = Vec::new();

    // Skip malformed stored votes so one bad entry does not suppress the full tally.
    match tokio::time::timeout(REDIS_CALL_TIMEOUT, conn.hvals::<_, Vec<String>>("vote_log")).await {
        Ok(Ok(values)) => {
            let votes: Vec<serde_json::Value> = values
                .into_iter()
                .filter_map(|s| serde_json::from_str(&s).ok())
                .collect();

            let msg = serde_json::json!({
                "type": "vote_update",
                "votes": votes
            });
            initial_messages.push(Message::Text(msg.to_string()));
        }
        Ok(Err(e)) => {
            println!("❌ Redis error while fetching vote_log: {}", e);
        }
        Err(_) => {
            println!("❌ Redis timed out while fetching vote_log, resetting connection");
            reset_redis_conn().await;
        }
    }

    // Keep rushee JSON as a string because the clients decode it after the event envelope.
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
            println!("❌ Redis error while fetching rushee: {}", e);
        }
        Err(_) => {
            println!("❌ Redis timed out while fetching rushee, resetting connection");
            reset_redis_conn().await;
        }
    }

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
            println!("❌ Redis error while fetching question: {}", e);
        }
        Err(_) => {
            println!("❌ Redis timed out while fetching question, resetting connection");
            reset_redis_conn().await;
        }
    }
    initial_messages
}
