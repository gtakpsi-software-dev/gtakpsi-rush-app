use crate::clients::{broadcast_to_clients, ClientMap};
use crate::db::{get_redis_conn, get_redis_pubsub, reset_redis_conn, REDIS_CALL_TIMEOUT};
use crate::protocol::{shared_update, vote_update};
use futures_util::StreamExt;
use redis::AsyncCommands;
use std::time::Duration;

pub async fn spawn_pubsub_listener(clients: ClientMap) {
    tokio::spawn(async move {
        loop {
            println!("🔄 Admin PubSub: Connecting to Redis...");

            match run_admin_pubsub_listener(clients.clone()).await {
                Ok(_) => {
                    println!("⚠️ Admin PubSub: Stream ended unexpectedly, reconnecting...");
                }
                Err(e) => {
                    println!("❌ Admin PubSub error: {}, reconnecting in 3s...", e);
                }
            }

            tokio::time::sleep(Duration::from_secs(3)).await;
        }
    });
}

async fn run_admin_pubsub_listener(
    clients: ClientMap,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut pubsub = get_redis_pubsub().await;

    pubsub.subscribe("vote_channel").await?;
    pubsub.subscribe("rushee").await?;
    pubsub.subscribe("question").await?;

    println!("✅ Admin PubSub: Connected and subscribed to channels");

    let mut stream = pubsub.on_message();
    while let Some(msg) = stream.next().await {
        let channel = msg.get_channel_name().to_string();

        if let Ok(payload) = msg.get_payload::<String>() {
            match channel.as_str() {
                "vote_channel" => {
                    // The pubsub payload signals a change; the admin board needs the full vote log.
                    let redis = get_redis_conn().await;
                    let mut conn = redis.as_ref().clone();

                    match tokio::time::timeout(
                        REDIS_CALL_TIMEOUT,
                        conn.hvals::<_, Vec<String>>("vote_log"),
                    )
                    .await
                    {
                        Ok(Ok(values)) => {
                            broadcast_to_clients(&clients, vote_update(values));
                        }
                        Ok(Err(e)) => {
                            println!("❌ Failed to fetch vote_log hash: {}", e);
                        }
                        Err(_) => {
                            println!("❌ Redis timed out fetching vote_log, resetting connection");
                            reset_redis_conn().await;
                        }
                    }
                }
                "rushee" | "question" => {
                    if let Some(message) = shared_update(&channel, &payload) {
                        broadcast_to_clients(&clients, message);
                    }
                }
                _ => {}
            }
        }
    }

    Ok(())
}
