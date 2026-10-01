use crate::middlewares::{self, auth::FirebaseAuth};
use axum::{
    http::{Method, StatusCode},
    middleware, Router,
};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

mod admin;
mod bidcom;
mod brother;
mod public;

pub fn create_router(firebase_auth: Arc<FirebaseAuth>) -> Router {
    let public_routes = public::routes();
    let brother_routes = brother::routes(firebase_auth.clone());
    let bidcom_routes = bidcom::routes(firebase_auth.clone());
    let admin_routes = admin::routes(firebase_auth);

    public_routes
        .merge(brother_routes)
        .merge(bidcom_routes)
        .merge(admin_routes)
        // Keep CORS outermost so browser preflight bypasses API-key and role gates.
        .layer(middleware::from_fn(middlewares::api_key::require_api_key))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods([
                    Method::GET,
                    Method::POST,
                    Method::PUT,
                    Method::DELETE,
                    Method::OPTIONS,
                ])
                .allow_headers(Any)
                .expose_headers(Any),
        )
}

async fn health_check() -> (StatusCode, String) {
    (StatusCode::OK, "Healthy!".to_string())
}

#[cfg(test)]
mod tests;
