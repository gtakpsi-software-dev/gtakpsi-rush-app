use super::{AuthError, FirebaseAuth};
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    middleware::Next,
};
use std::sync::Arc;

fn extract_bearer(headers: &HeaderMap) -> Option<String> {
    let value = headers.get(axum::http::header::AUTHORIZATION)?;
    let value = value.to_str().ok()?;
    value
        .strip_prefix("Bearer ")
        .or_else(|| value.strip_prefix("bearer "))
        .map(str::to_string)
}

pub async fn require_admin<B>(
    State(auth): State<Arc<FirebaseAuth>>,
    mut req: axum::http::Request<B>,
    next: Next<B>,
) -> Result<axum::response::Response, StatusCode>
where
    B: Send + 'static,
{
    let token = extract_bearer(req.headers()).ok_or(StatusCode::UNAUTHORIZED)?;

    let user = auth.verify_token(&token).await.map_err(|err| match err {
        AuthError::NotAdmin => StatusCode::FORBIDDEN,
        _ => StatusCode::UNAUTHORIZED,
    })?;

    req.extensions_mut().insert(user);
    Ok(next.run(req).await)
}

/// Middleware that allows both admin AND bid committee users
pub async fn require_bidcom_or_admin<B>(
    State(auth): State<Arc<FirebaseAuth>>,
    mut req: axum::http::Request<B>,
    next: Next<B>,
) -> Result<axum::response::Response, StatusCode>
where
    B: Send + 'static,
{
    let token = extract_bearer(req.headers()).ok_or(StatusCode::UNAUTHORIZED)?;

    let user = auth
        .verify_token_bidcom(&token)
        .await
        .map_err(|err| match err {
            AuthError::NotAdmin => StatusCode::FORBIDDEN,
            _ => StatusCode::UNAUTHORIZED,
        })?;

    req.extensions_mut().insert(user);
    Ok(next.run(req).await)
}

/// Middleware that allows ANY signed-in brother (no admin/bidcom/allowlist
/// gate) -- for endpoints like "my own PIS assignments" that every brother
/// needs, not just admins.
pub async fn require_any_brother<B>(
    State(auth): State<Arc<FirebaseAuth>>,
    mut req: axum::http::Request<B>,
    next: Next<B>,
) -> Result<axum::response::Response, StatusCode>
where
    B: Send + 'static,
{
    let token = extract_bearer(req.headers()).ok_or(StatusCode::UNAUTHORIZED)?;

    let user = auth
        .verify_token_any_brother(&token)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    req.extensions_mut().insert(user);
    Ok(next.run(req).await)
}
