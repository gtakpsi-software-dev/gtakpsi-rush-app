use super::*;

#[tokio::test]
async fn protected_routes_reject_missing_bearer_tokens_before_database_access() {
    for (method, path) in [
        (Method::POST, "/admin/get-brother-pis"),
        (Method::GET, "/bidcom/rushees/sorting"),
        (Method::PUT, "/bidcom/rushees/900000001/notes"),
        (Method::POST, "/admin/add_pis_question"),
        (Method::POST, "/admin/season/reset"),
        (Method::GET, "/admin/rushees/sorting"),
        (Method::PUT, "/admin/rushees/move"),
        (Method::POST, "/admin/make-admin"),
        (Method::POST, "/admin/make-bidcom"),
        (Method::POST, "/admin/get-admin-status"),
        (Method::POST, "/admin/comment-visibility/update"),
        (Method::GET, "/admin/comment-visibility/status"),
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
async fn admin_pis_availability_routes_keep_admin_auth_boundary() {
    for (method, path) in [
        (Method::POST, "/admin/pis-availability/send-form"),
        (Method::POST, "/admin/pis-availability/clear-and-resend"),
        (Method::POST, "/admin/pis-availability/deactivate"),
        (Method::GET, "/admin/pis-availability/all"),
        (Method::POST, "/admin/pis-availability/auto-assign"),
        (Method::POST, "/admin/pis-availability/clear-assignments"),
        (Method::GET, "/admin/pis-availability/export-csv"),
    ] {
        let protected = app()
            .oneshot(request(method, path, "{}", true))
            .await
            .unwrap();
        assert_eq!(protected.status(), StatusCode::UNAUTHORIZED, "{path}");
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
