use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        ConnectInfo, Path, State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use dashmap::DashMap;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::{env, net::SocketAddr, sync::Arc};
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};

/// Represents a connected client
#[derive(Clone)]
struct Client {
    id: String,
    is_admin: bool,
    name: Option<String>,
    tx: broadcast::Sender<String>,
}

type ClientMap = Arc<DashMap<String, Client>>;

/// Current drag state (who is dragging what)
#[derive(Clone, Default)]
struct DragState {
    dragger_id: Option<String>,
    dragger_name: Option<String>,
    rushee_id: Option<String>,
    rushee_name: Option<String>,
    position_x: f64,
    position_y: f64,
}

type SharedDragState = Arc<tokio::sync::RwLock<DragState>>;

/// Shared application state
struct AppState {
    clients: ClientMap,
    drag_state: SharedDragState,
    broadcast_tx: broadcast::Sender<String>,
}

// ============ Message Types ============

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
enum IncomingMessage {
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
    DragMove { x: f64, y: f64 },
    #[serde(rename = "drag_end")]
    DragEnd {},
    #[serde(rename = "card_saved")]
    CardSaved { rushee_id: String, new_status: String },
}

#[derive(Serialize, Debug)]
#[serde(tag = "type")]
enum OutgoingMessage {
    #[serde(rename = "drag_start")]
    DragStart {
        dragger_name: String,
        rushee_id: String,
        rushee_name: String,
        x: f64,
        y: f64,
    },
    #[serde(rename = "drag_move")]
    DragMove {
        rushee_id: String,
        x: f64,
        y: f64,
    },
    #[serde(rename = "drag_end")]
    DragEnd { rushee_id: String },
    #[serde(rename = "card_moved")]
    CardMoved { rushee_id: String, new_status: String },
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

// ============ Main ============

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let (broadcast_tx, _) = broadcast::channel::<String>(1000);

    let state = Arc::new(AppState {
        clients: Arc::new(DashMap::new()),
        drag_state: Arc::new(tokio::sync::RwLock::new(DragState::default())),
        broadcast_tx,
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/", get(|| async { "Sorting Broadcaster OK" }))
        .route("/health", get(|| async { "OK" }))
        .route("/ws", get(ws_handler))
        .layer(cors)
        .with_state(state);

    let port: u16 = env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(4001);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("Sorting Broadcaster listening on 0.0.0.0:{}", port);

    axum::Server::bind(&addr)
        .serve(app.into_make_service_with_connect_info::<SocketAddr>())
        .await
        .unwrap();
}

// ============ WebSocket Handler ============

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state, addr))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>, addr: SocketAddr) {
    let client_id = uuid::Uuid::new_v4().to_string();
    let (mut sender, mut receiver) = socket.split();

    // Create a channel for this client
    let (tx, mut rx) = broadcast::channel::<String>(100);

    // Subscribe to global broadcasts
    let mut global_rx = state.broadcast_tx.subscribe();

    // Add client to map (initially as viewer)
    let client = Client {
        id: client_id.clone(),
        is_admin: false,
        name: None,
        tx: tx.clone(),
    };
    state.clients.insert(client_id.clone(), client);

    println!("Client connected: {} from {}", client_id, addr);

    // Broadcast updated viewer count
    broadcast_viewer_count(&state).await;

    // Send current drag state to new client
    {
        let drag = state.drag_state.read().await;
        if drag.dragger_id.is_some() {
            let msg = OutgoingMessage::CurrentDrag {
                active: true,
                dragger_name: drag.dragger_name.clone(),
                rushee_id: drag.rushee_id.clone(),
                rushee_name: drag.rushee_name.clone(),
                x: drag.position_x,
                y: drag.position_y,
            };
            if let Ok(json) = serde_json::to_string(&msg) {
                let _ = tx.send(json);
            }
        }
    }

    // Spawn task to forward messages to this client
    let send_task = tokio::spawn(async move {
        loop {
            tokio::select! {
                // Messages from global broadcast
                Ok(msg) = global_rx.recv() => {
                    if sender.send(Message::Text(msg)).await.is_err() {
                        break;
                    }
                }
                // Messages specifically for this client
                Ok(msg) = rx.recv() => {
                    if sender.send(Message::Text(msg)).await.is_err() {
                        break;
                    }
                }
            }
        }
    });

    // Handle incoming messages
    let state_clone = state.clone();
    let client_id_clone = client_id.clone();
    
    while let Some(Ok(msg)) = receiver.next().await {
        if let Message::Text(text) = msg {
            handle_message(&text, &client_id_clone, &state_clone).await;
        }
    }

    // Cleanup on disconnect
    send_task.abort();
    
    // Check if this client was dragging
    {
        let mut drag = state.drag_state.write().await;
        if drag.dragger_id.as_ref() == Some(&client_id) {
            // Broadcast drag_end since dragger disconnected
            if let Some(rushee_id) = &drag.rushee_id {
                let msg = OutgoingMessage::DragEnd {
                    rushee_id: rushee_id.clone(),
                };
                if let Ok(json) = serde_json::to_string(&msg) {
                    let _ = state.broadcast_tx.send(json);
                }
            }
            *drag = DragState::default();
        }
    }
    
    state.clients.remove(&client_id);
    println!("Client disconnected: {}", client_id);
    
    broadcast_viewer_count(&state).await;
}

async fn handle_message(text: &str, client_id: &str, state: &Arc<AppState>) {
    let msg: Result<IncomingMessage, _> = serde_json::from_str(text);
    
    match msg {
        Ok(IncomingMessage::Join { is_admin, name }) => {
            // Update client info
            if let Some(mut client) = state.clients.get_mut(client_id) {
                client.is_admin = is_admin;
                client.name = name.clone();
            }
            println!("Client {} joined as admin={}, name={:?}", client_id, is_admin, name);
        }
        
        Ok(IncomingMessage::DragStart { rushee_id, rushee_name, x, y }) => {
            // Only admins can drag
            let is_admin = state.clients.get(client_id)
                .map(|c| c.is_admin)
                .unwrap_or(false);
            
            if !is_admin {
                return;
            }
            
            // Check if someone else is already dragging
            {
                let drag = state.drag_state.read().await;
                if drag.dragger_id.is_some() && drag.dragger_id.as_ref() != Some(&client_id.to_string()) {
                    return; // Someone else is dragging
                }
            }
            
            let dragger_name = state.clients.get(client_id)
                .and_then(|c| c.name.clone())
                .unwrap_or_else(|| "Admin".to_string());
            
            // Update drag state
            {
                let mut drag = state.drag_state.write().await;
                drag.dragger_id = Some(client_id.to_string());
                drag.dragger_name = Some(dragger_name.clone());
                drag.rushee_id = Some(rushee_id.clone());
                drag.rushee_name = Some(rushee_name.clone());
                drag.position_x = x;
                drag.position_y = y;
            }
            
            // Broadcast to all clients
            let msg = OutgoingMessage::DragStart {
                dragger_name,
                rushee_id,
                rushee_name,
                x,
                y,
            };
            if let Ok(json) = serde_json::to_string(&msg) {
                let _ = state.broadcast_tx.send(json);
            }
        }
        
        Ok(IncomingMessage::DragMove { x, y }) => {
            // Only the current dragger can send move updates
            let is_dragger = {
                let drag = state.drag_state.read().await;
                drag.dragger_id.as_ref() == Some(&client_id.to_string())
            };
            
            if !is_dragger {
                return;
            }
            
            let rushee_id = {
                let mut drag = state.drag_state.write().await;
                drag.position_x = x;
                drag.position_y = y;
                drag.rushee_id.clone()
            };
            
            if let Some(rushee_id) = rushee_id {
                let msg = OutgoingMessage::DragMove { rushee_id, x, y };
                if let Ok(json) = serde_json::to_string(&msg) {
                    let _ = state.broadcast_tx.send(json);
                }
            }
        }
        
        Ok(IncomingMessage::DragEnd {}) => {
            // Only the current dragger can end
            let is_dragger = {
                let drag = state.drag_state.read().await;
                drag.dragger_id.as_ref() == Some(&client_id.to_string())
            };
            
            if !is_dragger {
                return;
            }
            
            let rushee_id = {
                let mut drag = state.drag_state.write().await;
                let id = drag.rushee_id.clone();
                *drag = DragState::default();
                id
            };
            
            if let Some(rushee_id) = rushee_id {
                let msg = OutgoingMessage::DragEnd { rushee_id };
                if let Ok(json) = serde_json::to_string(&msg) {
                    let _ = state.broadcast_tx.send(json);
                }
            }
        }
        
        Ok(IncomingMessage::CardSaved { rushee_id, new_status }) => {
            // Only admins can notify of saves
            let is_admin = state.clients.get(client_id)
                .map(|c| c.is_admin)
                .unwrap_or(false);
            
            if !is_admin {
                return;
            }
            
            let msg = OutgoingMessage::CardMoved { rushee_id, new_status };
            if let Ok(json) = serde_json::to_string(&msg) {
                let _ = state.broadcast_tx.send(json);
            }
        }
        
        Err(e) => {
            println!("Failed to parse message: {} - {}", text, e);
        }
    }
}

async fn broadcast_viewer_count(state: &Arc<AppState>) {
    let count = state.clients.len();
    let msg = OutgoingMessage::ViewerCount { count };
    if let Ok(json) = serde_json::to_string(&msg) {
        let _ = state.broadcast_tx.send(json);
    }
}

