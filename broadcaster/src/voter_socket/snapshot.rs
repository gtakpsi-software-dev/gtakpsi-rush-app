use crate::snapshot::load_field;
use axum::extract::ws::Message;
use redis::aio::ConnectionManager;

pub(super) async fn load_initial_messages(mut conn: ConnectionManager) -> Vec<Message> {
    let mut initial_messages = Vec::new();

    if let Some(message) = load_field(&mut conn, "rushee", "'rushee'").await {
        initial_messages.push(message);
    }
    if let Some(message) = load_field(&mut conn, "question", "'question'").await {
        initial_messages.push(message);
    }

    initial_messages
}
