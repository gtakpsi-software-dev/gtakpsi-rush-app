use super::*;

// Verify that browser preflight succeeds without API-key or role credentials.
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
