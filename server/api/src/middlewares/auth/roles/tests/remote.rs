use crate::middlewares::auth::{AuthError, FirebaseAuth, ServiceAccount};
use axum::{
    extract::{Form, State},
    http::{HeaderMap, StatusCode, Uri},
    routing::post,
    Json, Router,
};
use serde_json::{json, Value};
use std::{collections::HashMap, net::TcpListener, sync::Arc};
use tokio::{sync::Mutex, task::JoinHandle};

#[derive(Clone, Debug)]
struct RecordedRequest {
    action: &'static str,
    authorization: String,
    body: Value,
}

#[derive(Clone)]
struct MockState {
    requests: Arc<Mutex<Vec<RecordedRequest>>>,
    lookup_status: StatusCode,
    lookup_body: Value,
    update_status: StatusCode,
}

async fn token(Form(body): Form<HashMap<String, String>>) -> Json<Value> {
    assert_eq!(
        body.get("grant_type").map(String::as_str),
        Some("urn:ietf:params:oauth:grant-type:jwt-bearer")
    );
    assert!(body.get("assertion").is_some_and(|value| !value.is_empty()));
    Json(json!({"access_token": "local-access-token"}))
}

async fn record(state: &MockState, action: &'static str, headers: HeaderMap, body: Value) {
    state.requests.lock().await.push(RecordedRequest {
        action,
        authorization: headers
            .get("authorization")
            .unwrap()
            .to_str()
            .unwrap()
            .to_string(),
        body,
    });
}

async fn identity_action(
    State(state): State<MockState>,
    uri: Uri,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> (StatusCode, Json<Value>) {
    match uri.path() {
        "/v1/projects/test-project/accounts:lookup" => {
            record(&state, "lookup", headers, body).await;
            (state.lookup_status, Json(state.lookup_body))
        }
        "/v1/projects/test-project/accounts:update" => {
            record(&state, "update", headers, body).await;
            (state.update_status, Json(json!({})))
        }
        _ => (StatusCode::NOT_FOUND, Json(json!({}))),
    }
}

struct MockServer {
    url: String,
    requests: Arc<Mutex<Vec<RecordedRequest>>>,
    task: JoinHandle<()>,
}

impl MockServer {
    fn start(lookup_status: StatusCode, lookup_body: Value, update_status: StatusCode) -> Self {
        let requests = Arc::new(Mutex::new(Vec::new()));
        let state = MockState {
            requests: requests.clone(),
            lookup_status,
            lookup_body,
            update_status,
        };
        let app = Router::new()
            .route("/token", post(token))
            .fallback(post(identity_action))
            .with_state(state);
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let task = tokio::spawn(async move {
            axum::Server::from_tcp(listener)
                .unwrap()
                .serve(app.into_make_service())
                .await
                .unwrap();
        });
        Self {
            url,
            requests,
            task,
        }
    }

    fn auth(&self) -> FirebaseAuth {
        let service_account = ServiceAccount {
            client_email: "service@example.test".to_string(),
            private_key: include_str!("../../tests/fixtures/test-only-private.pem").to_string(),
            token_uri: format!("{}/token", self.url),
            project_id: Some("test-project".to_string()),
        };
        let mut auth =
            FirebaseAuth::new("fallback-project".to_string(), None, Some(service_account));
        auth.identity_toolkit_base_url = Some(self.url.clone());
        auth
    }

    async fn requests(&self) -> Vec<RecordedRequest> {
        self.requests.lock().await.clone()
    }
}

impl Drop for MockServer {
    fn drop(&mut self) {
        self.task.abort();
    }
}

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
