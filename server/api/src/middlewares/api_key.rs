use axum::{
    http::{Method, Request, StatusCode},
    middleware::Next,
    response::Response,
};
use std::env;

/// Health checks remain reachable without the browser's shared API key.
const EXCLUDED_PATHS: &[&str] = &["/", "/health"];

/// Gate requests with the browser's shared key; protected routes separately
/// enforce Firebase identity and role checks.
pub async fn require_api_key<B>(req: Request<B>, next: Next<B>) -> Result<Response, StatusCode>
where
    B: Send + 'static,
{
    // Browser preflight cannot supply the custom API key header.
    if req.method() == Method::OPTIONS {
        return Ok(next.run(req).await);
    }

    let path = req.uri().path();
    if EXCLUDED_PATHS.contains(&path) {
        return Ok(next.run(req).await);
    }

    let expected_key = match env::var("API_KEY") {
        Ok(key) if !key.is_empty() => key,
        _ => {
            // Preserve the existing open mode when the deployment omits this key.
            tracing::warn!("API_KEY environment variable not set - API key validation disabled");
            return Ok(next.run(req).await);
        }
    };

    let provided_key = req
        .headers()
        .get("X-API-Key")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    match provided_key {
        Some(key) if key == expected_key => Ok(next.run(req).await),
        Some(_) => {
            tracing::warn!("Invalid API key provided");
            Err(StatusCode::UNAUTHORIZED)
        }
        None => {
            tracing::warn!("No API key provided in request");
            Err(StatusCode::UNAUTHORIZED)
        }
    }
}
