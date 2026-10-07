use dashmap::DashMap;
use std::{collections::HashMap, sync::Arc, time::Instant};
use tokio::sync::broadcast;

#[derive(Clone)]
pub(crate) struct Client {
    pub(crate) is_admin: bool,
    pub(crate) name: Option<String>,
    pub(crate) tx: broadcast::Sender<String>,
}

pub(crate) type ClientMap = Arc<DashMap<String, Client>>;

/// Current drag state (per rushee)
#[derive(Clone, Debug)]
pub(crate) struct DragState {
    pub(crate) dragger_id: String,
    pub(crate) dragger_name: String,
    pub(crate) rushee_id: String,
    pub(crate) rushee_name: String,
    pub(crate) position_x: f64,
    pub(crate) position_y: f64,
    pub(crate) last_update: Instant,
}

pub(crate) type SharedDragState = Arc<tokio::sync::RwLock<HashMap<String, DragState>>>;

pub(crate) struct AppState {
    pub(crate) clients: ClientMap,
    pub(crate) drag_state: SharedDragState,
    pub(crate) broadcast_tx: broadcast::Sender<String>,
}

pub(crate) fn new_state() -> Arc<AppState> {
    let (broadcast_tx, _) = broadcast::channel::<String>(1000);

    Arc::new(AppState {
        clients: Arc::new(DashMap::new()),
        drag_state: Arc::new(tokio::sync::RwLock::new(HashMap::new())),
        broadcast_tx,
    })
}
