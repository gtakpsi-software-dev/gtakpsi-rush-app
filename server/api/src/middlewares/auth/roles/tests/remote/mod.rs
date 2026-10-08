mod support;

use crate::middlewares::auth::AuthError;
use axum::http::StatusCode;
use serde_json::{json, Value};
use support::MockServer;

// Verify authenticated lookup-before-update requests and retention of unrelated claims.
#[tokio::test]
async fn role_updates_preserve_unrelated_claims_and_use_ordered_lookup_then_update() {
    let server = MockServer::start(
        StatusCode::OK,
        json!({"users": [{"customAttributes": "{\"admin\":true,\"bidcom\":false,\"theme\":\"dark\"}"}]}),
        StatusCode::OK,
    );
    let auth = server.auth();

    assert_eq!(
        auth.get_user_roles("brother-1").await.unwrap(),
        (true, false)
    );
    auth.set_bidcom_claim("brother-1", true).await.unwrap();
    auth.set_admin_claim("brother-1", false).await.unwrap();

    let requests = server.requests().await;
    assert_eq!(
        requests
            .iter()
            .map(|request| request.action)
            .collect::<Vec<_>>(),
        ["lookup", "lookup", "update", "lookup", "update"]
    );
    for request in &requests {
        assert_eq!(request.authorization, "Bearer local-access-token");
    }
    for request in requests.iter().filter(|request| request.action == "lookup") {
        assert_eq!(request.body, json!({"localId": ["brother-1"]}));
    }
    let updates: Vec<Value> = requests
        .iter()
        .filter(|request| request.action == "update")
        .map(|request| {
            serde_json::from_str(request.body["customAttributes"].as_str().unwrap()).unwrap()
        })
        .collect();
    assert_eq!(
        updates[0],
        json!({"admin": true, "bidcom": true, "theme": "dark"})
    );
    assert_eq!(
        updates[1],
        json!({"admin": false, "bidcom": false, "theme": "dark"})
    );
    assert!(requests
        .iter()
        .filter(|request| request.action == "update")
        .all(|request| request.body["localId"] == "brother-1"));
}

// Verify the empty-claims fallback when a lookup fails before a role update.
#[tokio::test]
async fn failed_lookup_still_updates_from_an_empty_claim_map() {
    let server = MockServer::start(StatusCode::INTERNAL_SERVER_ERROR, json!({}), StatusCode::OK);
    server
        .auth()
        .set_admin_claim("brother-2", true)
        .await
        .unwrap();

    let requests = server.requests().await;
    assert_eq!(
        requests
            .iter()
            .map(|request| request.action)
            .collect::<Vec<_>>(),
        ["lookup", "update"]
    );
    assert_eq!(requests[1].body["localId"], "brother-2");
    let attributes: Value =
        serde_json::from_str(requests[1].body["customAttributes"].as_str().unwrap()).unwrap();
    assert_eq!(attributes, json!({"admin": true}));
}

// Verify that direct role reads report a failed Firebase lookup.
#[tokio::test]
async fn failed_lookup_returns_internal_for_a_direct_role_read() {
    let server = MockServer::start(StatusCode::INTERNAL_SERVER_ERROR, json!({}), StatusCode::OK);
    assert!(matches!(
        server.auth().get_user_roles("brother-4").await,
        Err(AuthError::Internal)
    ));

    let requests = server.requests().await;
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0].action, "lookup");
    assert_eq!(requests[0].body, json!({"localId": ["brother-4"]}));
}

// Verify that a malformed OAuth response prevents Firebase account requests.
#[tokio::test]
async fn missing_oauth_access_token_stops_before_identity_toolkit_requests() {
    let server = MockServer::start_with_token_body(
        json!({}),
        StatusCode::OK,
        json!({"users": []}),
        StatusCode::OK,
    );
    assert!(matches!(
        server.auth().get_user_roles("brother-5").await,
        Err(AuthError::Internal)
    ));
    assert!(server.requests().await.is_empty());
}

// Verify that Firebase update failures propagate after a successful claims lookup.
#[tokio::test]
async fn failed_update_returns_internal_after_a_successful_lookup() {
    let server = MockServer::start(
        StatusCode::OK,
        json!({"users": [{"customAttributes": "{\"admin\":true,\"theme\":\"dark\"}"}]}),
        StatusCode::INTERNAL_SERVER_ERROR,
    );
    assert!(matches!(
        server.auth().set_bidcom_claim("brother-3", false).await,
        Err(AuthError::Internal)
    ));

    let requests = server.requests().await;
    assert_eq!(
        requests
            .iter()
            .map(|request| request.action)
            .collect::<Vec<_>>(),
        ["lookup", "update"]
    );
    let attributes: Value =
        serde_json::from_str(requests[1].body["customAttributes"].as_str().unwrap()).unwrap();
    assert_eq!(
        attributes,
        json!({"admin": true, "bidcom": false, "theme": "dark"})
    );
}
