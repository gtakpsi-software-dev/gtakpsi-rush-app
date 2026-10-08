use super::{create_router, public};
use crate::middlewares::auth::FirebaseAuth;
use axum::{
    body::{Body, HttpBody},
    http::{Method, Request, StatusCode},
};
use std::{env, sync::Arc};
use tower::ServiceExt;

// Build the API router with test Firebase configuration.
fn app() -> axum::Router {
    create_router(Arc::new(FirebaseAuth::new(
        "local-test-project".to_string(),
        None,
        None,
    )))
}

// Build a JSON request with an optional configured API key.
fn request(method: Method, path: &str, body: &str, include_api_key: bool) -> Request<Body> {
    let mut request = Request::builder()
        .method(method)
        .uri(path)
        .header("content-type", "application/json");
    if include_api_key {
        if let Ok(key) = env::var("API_KEY") {
            request = request.header("x-api-key", key);
        }
    }
    request.body(Body::from(body.to_string())).unwrap()
}

mod cors_contracts;
mod protected_contracts;
mod public_contracts;
