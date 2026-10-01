use crate::middlewares::auth::FirebaseAuth;
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

/// Promote/demote a brother to admin (protected by admin middleware)
pub async fn make_admin(
    State(auth): State<std::sync::Arc<FirebaseAuth>>,
    Json(payload): Json<AdminTogglePayload>,
) -> Result<Json<Value>, StatusCode> {
    let make_admin = payload.make_admin.unwrap_or(true);

    match auth.set_admin_claim(&payload.uid, make_admin).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": if make_admin { "Admin access granted" } else { "Admin access removed" }
        }))),
        Err(crate::middlewares::auth::AuthError::ServiceAccountMissing) => Ok(Json(json!({
            "status": "error",
            "message": "Service account missing on server; cannot update admin claim"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to update admin claim"
        }))),
    }
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

    match auth.set_bidcom_claim(&payload.uid, make_bidcom).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": if make_bidcom { "Bid committee access granted" } else { "Bid committee access removed" }
        }))),
        Err(crate::middlewares::auth::AuthError::ServiceAccountMissing) => Ok(Json(json!({
            "status": "error",
            "message": "Service account missing on server; cannot update bidcom claim"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to update bidcom claim"
        }))),
    }
}
