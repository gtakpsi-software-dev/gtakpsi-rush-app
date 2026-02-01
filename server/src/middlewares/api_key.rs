use axum::{
    http::{Method, Request, StatusCode},
    middleware::Next,
    response::Response,
};
use std::env;

/// Middleware to validate API key from X-API-Key header
/// 
/// This ensures only authorized clients (our frontend) can access the API.
/// The API key should be set via the API_KEY environment variable on the server
/// and VITE_API_KEY on the client.
pub async fn require_api_key<B>(
    req: Request<B>,
    next: Next<B>,
) -> Result<Response, StatusCode>
where
    B: Send + 'static,
{
    // Skip API key check for OPTIONS requests (CORS preflight)
    if req.method() == Method::OPTIONS {
        return Ok(next.run(req).await);
    }

    // Get the expected API key from environment
    let expected_key = match env::var("API_KEY") {
        Ok(key) if !key.is_empty() => key,
        _ => {
            // If API_KEY is not set, log warning but allow requests (for development)
            tracing::warn!("API_KEY environment variable not set - API key validation disabled");
            return Ok(next.run(req).await);
        }
    };

    // Extract API key from request header
    let provided_key = req
        .headers()
        .get("X-API-Key")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    match provided_key {
        Some(key) if key == expected_key => {
            // Valid API key, proceed with request
            Ok(next.run(req).await)
        }
        Some(_) => {
            // Invalid API key
            tracing::warn!("Invalid API key provided");
            Err(StatusCode::UNAUTHORIZED)
        }
        None => {
            // No API key provided
            tracing::warn!("No API key provided in request");
            Err(StatusCode::UNAUTHORIZED)
        }
    }
}
