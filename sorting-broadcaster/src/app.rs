use crate::{session::ws_handler, state::AppState};
use axum::{routing::get, Router};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

pub(crate) fn create_router(state: Arc<AppState>) -> Router {
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
    app
}
