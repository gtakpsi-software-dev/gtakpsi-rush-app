use super::*;
use std::sync::Arc;

// Build test authentication state without service-account credentials.
fn auth_without_service_account() -> State<Arc<FirebaseAuth>> {
    State(Arc::new(FirebaseAuth::new(
        "test-project".to_string(),
        None,
        None,
    )))
}

// Verify endpoint-specific errors when service-account credentials are absent.
#[tokio::test]
async fn role_endpoints_keep_their_distinct_missing_service_account_responses() {
    assert_eq!(
        make_admin(
            auth_without_service_account(),
            Json(AdminTogglePayload {
                uid: "brother-1".to_string(),
                make_admin: Some(false),
            }),
        )
        .await
        .unwrap()
        .0,
        json!({
            "status": "error",
            "message": "Service account missing on server; cannot update admin claim"
        })
    );
    assert_eq!(
        make_bidcom(
            auth_without_service_account(),
            Json(BidcomTogglePayload {
                uid: "brother-1".to_string(),
                make_bidcom: None,
            }),
        )
        .await
        .unwrap()
        .0,
        json!({
            "status": "error",
            "message": "Service account missing on server; cannot update bidcom claim"
        })
    );
    assert_eq!(
        get_admin_status(
            auth_without_service_account(),
            Json(AdminStatusPayload {
                uid: "brother-1".to_string(),
            }),
        )
        .await
        .unwrap()
        .0,
        json!({
            "status": "error",
            "message": "Service account missing on server; cannot read user roles"
        })
    );
}

// Verify role-specific success and failure response messages.
#[test]
fn role_updates_keep_grant_revoke_and_generic_failure_messages() {
    for (role, granted, removed, failed) in [
        (
            RoleClaim::Admin,
            "Admin access granted",
            "Admin access removed",
            "Failed to update admin claim",
        ),
        (
            RoleClaim::BidCommittee,
            "Bid committee access granted",
            "Bid committee access removed",
            "Failed to update bidcom claim",
        ),
    ] {
        assert_eq!(
            role_update_response(Ok(()), true, role).unwrap().0,
            json!({"status": "success", "message": granted})
        );
        assert_eq!(
            role_update_response(Ok(()), false, role).unwrap().0,
            json!({"status": "success", "message": removed})
        );
        assert_eq!(
            role_update_response(Err(AuthError::Internal), true, role)
                .unwrap()
                .0,
            json!({"status": "error", "message": failed})
        );
    }
}
