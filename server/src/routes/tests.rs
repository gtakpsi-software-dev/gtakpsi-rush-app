use super::{create_router, public};
use crate::middlewares::auth::FirebaseAuth;
use axum::{
    body::{Body, HttpBody},
    http::{Method, Request, StatusCode},
};
use std::{env, sync::Arc};
use tower::ServiceExt;

fn app() -> axum::Router {
    create_router(Arc::new(FirebaseAuth::new(
        "local-test-project".to_string(),
        None,
        None,
    )))
}

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

#[tokio::test]
async fn health_checks_and_unknown_routes_keep_their_http_contracts() {
    for path in ["/", "/health"] {
        let response = app()
            .oneshot(request(Method::GET, path, "", false))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let mut body = response.into_body();
        let mut bytes = Vec::new();
        while let Some(chunk) = body.data().await {
            bytes.extend_from_slice(&chunk.unwrap());
        }
        assert_eq!(bytes, b"Healthy!");
    }
    let response = app()
        .oneshot(request(Method::GET, "/missing-route", "", true))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn protected_routes_reject_missing_bearer_tokens_before_database_access() {
    for (method, path) in [
        (Method::POST, "/admin/get-brother-pis"),
        (Method::GET, "/bidcom/rushees/sorting"),
        (Method::PUT, "/bidcom/rushees/900000001/notes"),
        (Method::POST, "/admin/add_pis_question"),
        (Method::GET, "/admin/rushees/sorting"),
        (Method::PUT, "/admin/rushees/move"),
        (Method::POST, "/admin/make-admin"),
        (Method::POST, "/admin/voting/post-question"),
    ] {
        let response = app()
            .oneshot(request(method, path, "{}", true))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED, "{path}");
    }
}

#[tokio::test]
async fn voting_routes_keep_their_methods_and_admin_auth_boundary() {
    let router = app();
    for (method, path) in [
        (Method::POST, "/admin/voting/change-rushee"),
        (Method::POST, "/admin/voting/clear-votes"),
        (Method::POST, "/admin/voting/make-eligible"),
        (Method::POST, "/admin/voting/make-ineligible"),
        (Method::GET, "/admin/voting/get-eligibility"),
        (Method::POST, "/admin/voting/post-question"),
        (Method::GET, "/admin/voting/get-rushee"),
    ] {
        let response = router
            .clone()
            .oneshot(request(method, path, "{}", true))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED, "{path}");
    }
}

#[tokio::test]
async fn public_json_routes_keep_extractor_validation_and_api_key_gating() {
    let api_key_enabled = env::var("API_KEY").is_ok_and(|key| !key.is_empty());
    let response = app()
        .oneshot(request(Method::POST, "/rushee/signup", "{}", false))
        .await
        .unwrap();
    let expected = if api_key_enabled {
        StatusCode::UNAUTHORIZED
    } else {
        StatusCode::UNPROCESSABLE_ENTITY
    };
    assert_eq!(response.status(), expected);
    let mut invalid_key = request(Method::POST, "/rushee/signup", "{}", false);
    invalid_key
        .headers_mut()
        .insert("x-api-key", "invalid-test-key".parse().unwrap());
    assert_eq!(app().oneshot(invalid_key).await.unwrap().status(), expected);
    for (body, expected) in [
        ("{}", StatusCode::UNPROCESSABLE_ENTITY),
        ("{", StatusCode::BAD_REQUEST),
    ] {
        let response = app()
            .oneshot(request(Method::POST, "/rushee/signup", body, true))
            .await
            .unwrap();
        assert_eq!(response.status(), expected);
    }
}

#[tokio::test]
async fn rushee_public_routes_keep_paths_methods_and_preflight_behavior() {
    let routes = [
        (Method::POST, "/rushee/signup", true),
        (Method::GET, "/rushee/get-rushees", true),
        (Method::GET, "/rushee/rush-nights", true),
        (Method::GET, "/rushee/900000001", true),
        (Method::GET, "/rushee/self/900000001", true),
        (Method::GET, "/rushee/get-pis-questions/900000001", true),
        (Method::POST, "/rushee/post-comment/900000001", true),
        (Method::POST, "/rushee/post-pis/900000001", true),
        (Method::POST, "/rushee/autosave-pis/900000001", true),
        (Method::POST, "/rushee/update-attendance/900000001", true),
        (Method::POST, "/rushee/update-cloud/900000001", true),
        (Method::POST, "/rushee/update-rushee/900000001", true),
        (Method::POST, "/rushee/reschedule-pis/900000001", true),
        (Method::POST, "/rushee/edit-comment/900000001", true),
        (Method::POST, "/rushee/delete-comment/900000001", true),
        (Method::GET, "/rushee/does-rushee-exist/900000001", false),
        (Method::GET, "/rushee/get-timeslots", false),
        (Method::GET, "/rushee/get-available-timeslots", false),
    ];

    for (allowed, path, has_preflight) in routes {
        let wrong_method = if allowed == Method::GET {
            Method::POST
        } else {
            Method::GET
        };
        let wrong = public::routes()
            .oneshot(request(wrong_method, path, "", false))
            .await
            .unwrap();
        assert_eq!(wrong.status(), StatusCode::METHOD_NOT_ALLOWED, "{path}");

        let preflight = public::routes()
            .oneshot(request(Method::OPTIONS, path, "", false))
            .await
            .unwrap();
        let expected = if has_preflight {
            StatusCode::OK
        } else {
            StatusCode::METHOD_NOT_ALLOWED
        };
        assert_eq!(preflight.status(), expected, "{path}");
    }
}

#[tokio::test]
async fn malformed_authorization_is_rejected_without_fetching_firebase_keys() {
    for authorization in ["Basic invalid", "Bearer malformed", "bearer malformed"] {
        let mut request = request(Method::GET, "/admin/rushees/sorting", "", true);
        request
            .headers_mut()
            .insert("authorization", authorization.parse().unwrap());
        let response = app().oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }
}

#[tokio::test]
async fn cors_preflight_bypasses_api_key_and_role_gates() {
    let request = Request::builder()
        .method(Method::OPTIONS)
        .uri("/admin/rushees/move")
        .header("origin", "https://client.example.invalid")
        .header("access-control-request-method", "PUT")
        .header("access-control-request-headers", "authorization,x-api-key")
        .body(Body::empty())
        .unwrap();
    let response = app().oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()["access-control-allow-origin"], "*");
    assert_eq!(response.headers()["access-control-allow-headers"], "*");
    assert!(response.headers()["access-control-allow-methods"]
        .to_str()
        .unwrap()
        .contains("PUT"));
}
