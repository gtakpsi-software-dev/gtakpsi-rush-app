use crate::clients::{broadcast_to_clients, ClientList};
use crate::db::get_redis_pubsub;
use futures_util::StreamExt;
use std::time::Duration;

pub async fn spawn_pubsub_listener(clients: ClientList) {
    tokio::spawn(async move {
        loop {
            println!("🔄 Voter PubSub: Connecting to Redis...");

            match run_voter_pubsub_listener(clients.clone()).await {
                Ok(_) => {
                    println!("⚠️ Voter PubSub: Stream ended unexpectedly, reconnecting...");
                }
                Err(e) => {
                    println!("❌ Voter PubSub error: {}, reconnecting in 3s...", e);
                }
            }

            // Wait before reconnecting
            tokio::time::sleep(Duration::from_secs(3)).await;
        }
    });
}

async fn run_voter_pubsub_listener(
    clients: ClientList,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut pubsub = get_redis_pubsub().await;

    pubsub.subscribe("rushee").await?;
    pubsub.subscribe("question").await?;

    println!("✅ Voter PubSub: Connected and subscribed to channels");

    let mut stream = pubsub.on_message();
    while let Some(msg) = stream.next().await {
        let channel = msg.get_channel_name().to_string();
        if let Ok(payload) = msg.get_payload::<String>() {
            let msg = match channel.as_str() {
                "rushee" => serde_json::json!({
                    "type": "rushee_update",
                    "rushee": payload
                }),
                "question" => serde_json::json!({
                    "type": "question_update",
                    "question": payload
                }),
                _ => continue,
            };
            broadcast_to_clients(&clients, msg.to_string());
        }
    }

    Ok(())
}
