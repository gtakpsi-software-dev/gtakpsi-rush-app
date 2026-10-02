use crate::middlewares::auth::{AuthError, FirebaseAuth};
use axum::extract::State;
use axum::{http::StatusCode, response::Json};
use serde_json::{json, Value};

#[derive(serde::Deserialize)]
pub struct AdminTogglePayload {
    pub uid: String,
    #[serde(default)]
    pub make_admin: Option<bool>,
}

#[derive(serde::Deserialize)]
pub struct AdminStatusPayload {
    pub uid: String,
}

#[derive(Clone, Copy)]
enum RoleClaim {
    Admin,
    BidCommittee,
}

fn role_update_response(
    outcome: Result<(), AuthError>,
    enabled: bool,
    role: RoleClaim,
) -> Result<Json<Value>, StatusCode> {
    let (granted, removed, missing_service_account, failed) = match role {
        RoleClaim::Admin => (
            "Admin access granted",
            "Admin access removed",
            "Service account missing on server; cannot update admin claim",
            "Failed to update admin claim",
        ),
        RoleClaim::BidCommittee => (
            "Bid committee access granted",
            "Bid committee access removed",
            "Service account missing on server; cannot update bidcom claim",
            "Failed to update bidcom claim",
        ),
    };
    let (status, message) = match outcome {
        Ok(()) => ("success", if enabled { granted } else { removed }),
        Err(AuthError::ServiceAccountMissing) => ("error", missing_service_account),
        Err(_) => ("error", failed),
    };

    Ok(Json(json!({ "status": status, "message": message })))
}

/// Promote/demote a brother to admin (protected by admin middleware)
pub async fn make_admin(
    State(auth): State<std::sync::Arc<FirebaseAuth>>,
    Json(payload): Json<AdminTogglePayload>,
) -> Result<Json<Value>, StatusCode> {
    let make_admin = payload.make_admin.unwrap_or(true);

    role_update_response(
        auth.set_admin_claim(&payload.uid, make_admin).await,
        make_admin,
        RoleClaim::Admin,
    )
}

/// Check admin and bidcom status for a given uid
pub async fn get_admin_status(
    State(auth): State<std::sync::Arc<FirebaseAuth>>,
    Json(payload): Json<AdminStatusPayload>,
) -> Result<Json<Value>, StatusCode> {
    match auth.get_user_roles(&payload.uid).await {
        Ok((is_admin, is_bidcom)) => Ok(Json(json!({
            "status": "success",
            "admin": is_admin,
            "bidcom": is_bidcom
        }))),
        Err(crate::middlewares::auth::AuthError::ServiceAccountMissing) => Ok(Json(json!({
            "status": "error",
            "message": "Service account missing on server; cannot read user roles"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to read user roles"
        }))),
    }
}

#[derive(serde::Deserialize)]
pub struct BidcomTogglePayload {
    pub uid: String,
    #[serde(default)]
    pub make_bidcom: Option<bool>,
}

/// Promote/demote a brother to bid committee (protected by admin middleware)
pub async fn make_bidcom(
    State(auth): State<std::sync::Arc<FirebaseAuth>>,
    Json(payload): Json<BidcomTogglePayload>,
) -> Result<Json<Value>, StatusCode> {
    let make_bidcom = payload.make_bidcom.unwrap_or(true);

    role_update_response(
        auth.set_bidcom_claim(&payload.uid, make_bidcom).await,
        make_bidcom,
        RoleClaim::BidCommittee,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    fn auth_without_service_account() -> State<Arc<FirebaseAuth>> {
        State(Arc::new(FirebaseAuth::new(
            "test-project".to_string(),
            None,
            None,
        )))
    }

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
}
