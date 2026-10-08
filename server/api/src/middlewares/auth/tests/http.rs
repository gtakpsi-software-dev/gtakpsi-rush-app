use super::*;
use crate::middlewares::auth::{
    require_admin, require_any_brother, require_bidcom_or_admin, FirebaseUser,
};
use axum::{
    body::{Body, HttpBody},
    http::{Request, StatusCode},
    middleware,
    routing::get,
    Extension, Json, Router,
};
use std::sync::Arc;
use tower::ServiceExt;

// Build test routes protected by each authentication middleware.
async fn app(allowlist: Option<&str>) -> Router {
    let auth = Arc::new(auth(allowlist).await);
    Router::new()
        .route(
            "/admin",
            get(identity).route_layer(middleware::from_fn_with_state(auth.clone(), require_admin)),
        )
        .route(
            "/bidcom",
            get(identity).route_layer(middleware::from_fn_with_state(
                auth.clone(),
                require_bidcom_or_admin,
            )),
        )
        .route(
            "/brother",
            get(identity).route_layer(middleware::from_fn_with_state(
                auth.clone(),
                require_any_brother,
            )),
        )
        .with_state(auth)
}

// Return the verified identity attached by authentication middleware.
async fn identity(Extension(user): Extension<FirebaseUser>) -> Json<Value> {
    Json(
        json!({"uid": user.uid, "email": user.email, "admin": user.is_admin, "bidcom": user.is_bidcom}),
    )
}

// Send an in-process request and collect its status and response bytes.
async fn request(app: &Router, path: &str, authorization: Option<&str>) -> (StatusCode, Vec<u8>) {
    let mut request = Request::builder().uri(path);
    if let Some(value) = authorization {
        request = request.header("authorization", value);
    }
    let response = app
        .clone()
        .oneshot(request.body(Body::empty()).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let mut body = response.into_body();
    let mut bytes = Vec::new();
    while let Some(chunk) = body.data().await {
        bytes.extend_from_slice(&chunk.unwrap());
    }
    (status, bytes)
}

// Verify each role gate and the identity received by permitted handlers.
#[tokio::test]
async fn middleware_gates_roles_and_passes_verified_identity_to_handlers() {
    for (admin, bidcom, allowlisted) in [
        (false, false, false),
        (false, true, false),
        (true, false, false),
        (false, false, true),
    ] {
        let app = app(allowlisted.then_some("brother@example.test")).await;
        let mut claims = claims();
        claims["admin"] = json!(admin);
        claims["bidcom"] = json!(bidcom);
        let authorization = format!("Bearer {}", token(&claims));
        for (path, allowed) in [
            ("/brother", true),
            ("/bidcom", admin || bidcom || allowlisted),
            ("/admin", admin || allowlisted),
        ] {
            let (status, body) = request(&app, path, Some(&authorization)).await;
            assert_eq!(
                status,
                if allowed {
                    StatusCode::OK
                } else {
                    StatusCode::FORBIDDEN
                }
            );
            if allowed {
                assert_eq!(
                    serde_json::from_slice::<Value>(&body).unwrap(),
                    json!({
                        "uid": "test-brother-uid", "email": "brother@example.test",
                        "admin": admin || allowlisted, "bidcom": bidcom
                    })
                );
            }
        }
    }
}

// Verify accepted authorization prefixes and rejection of malformed headers.
#[tokio::test]
async fn bearer_parsing_preserves_supported_case_and_whitespace_rules() {
    let app = app(None).await;
    let mut claims = claims();
    claims["admin"] = json!(true);
    let token = token(&claims);
    for path in ["/brother", "/bidcom", "/admin"] {
        for prefix in ["Bearer ", "bearer "] {
            assert_eq!(
                request(&app, path, Some(&format!("{prefix}{token}")))
                    .await
                    .0,
                StatusCode::OK
            );
        }
        for prefix in ["BEARER ", "Basic ", "Bearer\t", "Bearer  "] {
            assert_eq!(
                request(&app, path, Some(&format!("{prefix}{token}")))
                    .await
                    .0,
                StatusCode::UNAUTHORIZED
            );
        }
        assert_eq!(request(&app, path, None).await.0, StatusCode::UNAUTHORIZED);
        assert_eq!(
            request(&app, path, Some("Bearer ")).await.0,
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            request(&app, path, Some("Bearer invalid")).await.0,
            StatusCode::UNAUTHORIZED
        );
    }
}

// Verify that ordinary brothers and bid committee members cannot reset the season.
#[tokio::test]
async fn season_reset_rejects_authenticated_non_admins() {
    let app = crate::routes::create_router(Arc::new(auth(None).await));
    for bidcom in [false, true] {
        let mut claims = claims();
        claims["bidcom"] = json!(bidcom);
        let mut request = Request::builder()
            .method("POST")
            .uri("/admin/season/reset")
            .header("authorization", format!("Bearer {}", token(&claims)));
        if let Ok(key) = std::env::var("API_KEY") {
            request = request.header("x-api-key", key);
        }
        let response = app
            .clone()
            .oneshot(request.body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }
}
