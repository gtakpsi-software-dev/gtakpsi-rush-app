use crate::{protocol::OutgoingMessage, state::AppState};
use std::{sync::Arc, time::Duration};

pub(crate) async fn run(cleanup_state: Arc<AppState>) {
    let stale_threshold = Duration::from_secs(60); // 60 seconds
    loop {
        tokio::time::sleep(Duration::from_secs(10)).await; // Check every 10 seconds

        let stale_ids: Vec<String> = {
            let drag = cleanup_state.drag_state.read().await;
            drag.iter()
                .filter(|(_, state)| state.last_update.elapsed() > stale_threshold)
                .map(|(id, _)| id.clone())
                .collect()
        };

        if !stale_ids.is_empty() {
            println!("Cleaning up {} stale drags", stale_ids.len());
            let mut drag = cleanup_state.drag_state.write().await;
            for id in &stale_ids {
                drag.remove(id);
            }
            drop(drag);

            // Broadcast drag_end for each stale drag
            for rushee_id in stale_ids {
                let msg = OutgoingMessage::DragEnd { rushee_id };
                if let Ok(json) = serde_json::to_string(&msg) {
                    let _ = cleanup_state.broadcast_tx.send(json);
                }
            }
        }
    }
}
