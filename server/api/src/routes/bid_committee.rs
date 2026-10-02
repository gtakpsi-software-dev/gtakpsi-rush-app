use crate::controllers;
use crate::middlewares::{self, auth::FirebaseAuth};
use axum::middleware;
use axum::{http::StatusCode, routing::get, Router};
use std::sync::Arc;

pub(super) fn routes(firebase_auth: Arc<FirebaseAuth>) -> Router {
    Router::new()
        .route(
            "/bidcom/rushees/sorting",
            get(controllers::admin::get_sorting_rushees).options(|| async { StatusCode::OK }),
        )
        .route(
            "/bidcom/rushees/:id/notes",
            get(controllers::admin::get_rushee_notes)
                .put(controllers::admin::update_rushee_notes)
                .options(|| async { StatusCode::OK }),
        )
        .route_layer(middleware::from_fn_with_state(
            firebase_auth.clone(),
            middlewares::auth::require_bidcom_or_admin,
        ))
        .with_state(firebase_auth.clone())
}
