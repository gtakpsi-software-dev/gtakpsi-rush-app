use super::{AuthError, FirebaseAuth, FirebaseUser};
use async_trait::async_trait;
use axum::{
    extract::{FromRef, FromRequestParts, State},
    http::{request::Parts, HeaderMap, StatusCode},
    middleware::Next,
};
use std::sync::Arc;

pub struct AdminUser(pub FirebaseUser);

#[async_trait]
impl<S> FromRequestParts<S> for AdminUser
where
    Arc<FirebaseAuth>: axum::extract::FromRef<S>,
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let auth = Arc::<FirebaseAuth>::from_ref(state);
        let token = extract_bearer(&parts.headers).ok_or(StatusCode::UNAUTHORIZED)?;
        // Preserve the extractor contract: token failures are 403, while a missing header is 401.
        let user = auth
            .verify_token(&token)
            .await
            .map_err(|_| StatusCode::FORBIDDEN)?;
        Ok(AdminUser(user))
    }
}

fn extract_bearer(headers: &HeaderMap) -> Option<String> {
    let value = headers.get(axum::http::header::AUTHORIZATION)?;
    let value = value.to_str().ok()?;
    if let Some(rest) = value.strip_prefix("Bearer ") {
        Some(rest.to_string())
    } else if let Some(rest) = value.strip_prefix("bearer ") {
        Some(rest.to_string())
    } else {
        None
    }
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
