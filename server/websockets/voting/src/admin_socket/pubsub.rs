use crate::clients::{broadcast_to_clients, ClientMap};
use crate::db::{get_redis_conn, get_redis_pubsub, reset_redis_conn, REDIS_CALL_TIMEOUT};
use crate::protocol::{shared_update, vote_update};
use crate::pubsub_retry::spawn_reconnecting_listener;
use futures_util::StreamExt;
use redis::AsyncCommands;

pub async fn spawn_pubsub_listener(clients: ClientMap) {
    spawn_reconnecting_listener(clients, "Admin", run_admin_pubsub_listener);
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
