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
mod tests;
