use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
pub(crate) enum IncomingMessage {
    #[serde(rename = "join")]
    Join {
        is_admin: bool,
        name: Option<String>,
    },
    #[serde(rename = "drag_start")]
    DragStart {
        rushee_id: String,
        rushee_name: String,
        x: f64,
        y: f64,
    },
    #[serde(rename = "drag_move")]
    DragMove { rushee_id: String, x: f64, y: f64 },
    #[serde(rename = "drag_end")]
    DragEnd { rushee_id: String },
    #[serde(rename = "card_saved")]
    CardSaved {
        rushee_id: String,
        new_status: String,
    },
}

#[derive(Serialize, Debug)]
#[serde(tag = "type")]
pub(crate) enum OutgoingMessage {
    #[serde(rename = "drag_start")]
    DragStart {
        dragger_name: String,
        rushee_id: String,
        rushee_name: String,
        x: f64,
        y: f64,
    },
    #[serde(rename = "drag_move")]
    DragMove { rushee_id: String, x: f64, y: f64 },
    #[serde(rename = "drag_end")]
    DragEnd { rushee_id: String },
    #[serde(rename = "card_moved")]
    CardMoved {
        rushee_id: String,
        new_status: String,
    },
    #[serde(rename = "drag_denied")]
    DragDenied {
        rushee_id: String,
        dragger_name: String,
    },
    #[serde(rename = "viewer_count")]
    ViewerCount { count: usize },
    #[serde(rename = "current_drag")]
    CurrentDrag {
        active: bool,
        dragger_name: Option<String>,
        rushee_id: Option<String>,
        rushee_name: Option<String>,
        x: f64,
        y: f64,
    },
}

// Serializes a sorting event and broadcasts it to the channel’s listeners.
pub(crate) fn send_outgoing_message(tx: &broadcast::Sender<String>, message: OutgoingMessage) {
    // Delivery remains best-effort when a listener has already disconnected.
    if let Ok(json) = serde_json::to_string(&message) {
        let _ = tx.send(json);
    }
}
