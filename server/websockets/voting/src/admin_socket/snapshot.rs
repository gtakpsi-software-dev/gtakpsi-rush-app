use crate::db::{reset_redis_conn, REDIS_CALL_TIMEOUT};
use crate::protocol::vote_update;
use crate::snapshot::load_field;
use axum::extract::ws::Message;
use redis::{aio::ConnectionManager, AsyncCommands};

pub(super) async fn load_initial_messages(mut conn: ConnectionManager) -> Vec<Message> {
    let mut initial_messages = Vec::new();

    match tokio::time::timeout(REDIS_CALL_TIMEOUT, conn.hvals::<_, Vec<String>>("vote_log")).await {
        Ok(Ok(values)) => {
            initial_messages.push(Message::Text(vote_update(values)));
        }
        Ok(Err(e)) => {
            println!("❌ Redis error while fetching vote_log: {}", e);
        }
        Err(_) => {
            println!("❌ Redis timed out while fetching vote_log, resetting connection");
            reset_redis_conn().await;
        }
    }

    if let Some(message) = load_field(&mut conn, "rushee", "rushee").await {
        initial_messages.push(message);
    }
    if let Some(message) = load_field(&mut conn, "question", "question").await {
        initial_messages.push(message);
    }

    initial_messages
}
