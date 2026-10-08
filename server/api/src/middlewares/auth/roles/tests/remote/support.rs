use crate::middlewares::auth::{FirebaseAuth, ServiceAccount};
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
pub(super) struct RecordedRequest {
    pub(super) action: &'static str,
    pub(super) authorization: String,
    pub(super) body: Value,
}

#[derive(Clone)]
struct MockState {
    requests: Arc<Mutex<Vec<RecordedRequest>>>,
    token_body: Value,
    lookup_status: StatusCode,
    lookup_body: Value,
    update_status: StatusCode,
}

// Validate the mock OAuth exchange payload and return the configured token response.
async fn token(
    State(state): State<MockState>,
    Form(body): Form<HashMap<String, String>>,
) -> Json<Value> {
    assert_eq!(
        body.get("grant_type").map(String::as_str),
        Some("urn:ietf:params:oauth:grant-type:jwt-bearer")
    );
    assert!(body.get("assertion").is_some_and(|value| !value.is_empty()));
    Json(state.token_body)
}

// Capture a mock Firebase request with its authorization header and JSON body.
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

// Record mock account lookups or updates and return their configured responses.
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

pub(super) struct MockServer {
    url: String,
    requests: Arc<Mutex<Vec<RecordedRequest>>>,
    task: JoinHandle<()>,
}

impl MockServer {
    // Start a mock Firebase server with a successful OAuth token response.
    pub(super) fn start(
        lookup_status: StatusCode,
        lookup_body: Value,
        update_status: StatusCode,
    ) -> Self {
        Self::start_with_token_body(
            json!({"access_token": "local-access-token"}),
            lookup_status,
            lookup_body,
            update_status,
        )
    }

    // Start a local OAuth and Firebase mock with configurable response bodies and statuses.
    pub(super) fn start_with_token_body(
        token_body: Value,
        lookup_status: StatusCode,
        lookup_body: Value,
        update_status: StatusCode,
    ) -> Self {
        let requests = Arc::new(Mutex::new(Vec::new()));
        let state = MockState {
            requests: requests.clone(),
            token_body,
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

    // Create authentication state that directs service-account requests to this mock server.
    pub(super) fn auth(&self) -> FirebaseAuth {
        let service_account = ServiceAccount {
            client_email: "service@example.test".to_string(),
            private_key: include_str!("../../../tests/fixtures/test-only-private.pem").to_string(),
            token_uri: format!("{}/token", self.url),
            project_id: Some("test-project".to_string()),
        };
        let mut auth =
            FirebaseAuth::new("fallback-project".to_string(), None, Some(service_account));
        auth.identity_toolkit_base_url = Some(self.url.clone());
        auth
    }

    // Return the requests recorded by the mock server.
    pub(super) async fn requests(&self) -> Vec<RecordedRequest> {
        self.requests.lock().await.clone()
    }
}

impl Drop for MockServer {
    // Stop the mock server task when its fixture leaves scope.
    fn drop(&mut self) {
        self.task.abort();
    }
}
