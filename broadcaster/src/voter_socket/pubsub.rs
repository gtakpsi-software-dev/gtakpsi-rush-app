use crate::clients::{broadcast_to_clients, ClientList};
use crate::db::get_redis_pubsub;
use crate::protocol::shared_update;
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
            if let Some(message) = shared_update(&channel, &payload) {
                broadcast_to_clients(&clients, message);
            }
        }
    }

    Ok(())
}
