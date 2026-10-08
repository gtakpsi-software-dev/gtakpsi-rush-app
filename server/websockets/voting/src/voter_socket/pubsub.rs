use crate::clients::{broadcast_to_clients, ClientMap};
use crate::db::get_redis_pubsub;
use crate::protocol::shared_update;
use crate::pubsub_retry::spawn_reconnecting_listener;
use futures_util::StreamExt;

// Starts the background subscription loop for voter updates.
pub async fn spawn_pubsub_listener(clients: ClientMap) {
    spawn_reconnecting_listener(clients, "Voter", run_voter_pubsub_listener);
}

// Forwards selected-rushee and question changes to connected voters.
async fn run_voter_pubsub_listener(
    clients: ClientMap,
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
