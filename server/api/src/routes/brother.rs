use crate::controllers;
use crate::middlewares::{self, auth::FirebaseAuth};
use axum::middleware;
use axum::{http::StatusCode, routing::post, Router};
use std::sync::Arc;

pub(super) fn routes(firebase_auth: Arc<FirebaseAuth>) -> Router {
    Router::new()
        .route(
            "/admin/get-brother-pis",
            post(controllers::admin::get_brother_pis).options(|| async { StatusCode::OK }),
        )
        .route_layer(middleware::from_fn_with_state(
            firebase_auth.clone(),
            middlewares::auth::require_any_brother,
        ))
        .with_state(firebase_auth.clone())
}
