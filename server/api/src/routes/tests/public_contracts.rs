use super::*;

// Verify health response bodies and unknown-route status codes.
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

// Verify comment-visibility route methods without accessing its handler.
#[tokio::test]
async fn public_comment_visibility_status_keeps_get_and_preflight_methods() {
    let path = "/brother/comment-visibility/status";
    let wrong = public::routes()
        .oneshot(request(Method::POST, path, "", false))
        .await
        .unwrap();
    assert_eq!(wrong.status(), StatusCode::METHOD_NOT_ALLOWED);

    let preflight = public::routes()
        .oneshot(request(Method::OPTIONS, path, "", false))
        .await
        .unwrap();
    assert_eq!(preflight.status(), StatusCode::OK);
}

// Verify API-key enforcement and malformed signup payload responses.
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

// Verify supported methods and preflight behavior across public rushee routes.
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
