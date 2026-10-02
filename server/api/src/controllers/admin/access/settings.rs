use crate::models::pis::{RushAppStatus, UpdateRushAppPayload};
use crate::storage::db;
use axum::extract::Extension;
use axum::{http::StatusCode, response::Json};
use mongodb::bson::{doc, DateTime};
use serde_json::{json, Value};

/// Update Rush App access settings (independent toggles for bidcom and regular brothers)
pub async fn update_rush_app_settings(
    Extension(user): Extension<crate::middlewares::auth::FirebaseUser>,
    Json(payload): Json<UpdateRushAppPayload>,
) -> Result<Json<Value>, StatusCode> {
    let collection = db::get_rush_app_status_collection().await;

    // Readers use the first status document, so clear old settings before insertion.
    // If clearing succeeds but insertion fails, readers see the default-open state.
    let _ = collection.delete_many(doc! {}).await;

    let status = RushAppStatus {
        disable_bidcom: payload.disable_bidcom,
        disable_regular: payload.disable_regular,
        midterm_mode: payload.midterm_mode,
        updated_at: Some(DateTime::now()),
        updated_by: Some(user.email.clone().unwrap_or(user.uid.clone())),
    };

    match collection.insert_one(status).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "Rush App settings updated"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to update Rush App settings"
        }))),
    }
}

/// Get current Rush App status (admin only)
pub async fn get_rush_app_status() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_rush_app_status_collection().await;

    match collection.find_one(doc! {}).await {
        Ok(Some(status)) => Ok(Json(json!({
            "status": "success",
            "disable_bidcom": status.disable_bidcom,
            "disable_regular": status.disable_regular,
            "midterm_mode": status.midterm_mode,
            "updated_at": status.updated_at,
            "updated_by": status.updated_by
        }))),
        Ok(None) => Ok(Json(json!({
            "status": "success",
            "disable_bidcom": false,
            "disable_regular": false,
            "midterm_mode": false,
            "updated_at": null,
            "updated_by": null
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to fetch Rush App status"
        }))),
    }
}

/// Get midterm mode status (public endpoint, no auth required)
pub async fn get_midterm_mode_status() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_rush_app_status_collection().await;

    // Keep the public status available when settings are absent or unreadable.
    let midterm_mode = match collection.find_one(doc! {}).await {
        Ok(Some(status)) => status.midterm_mode,
        Ok(None) | Err(_) => false,
    };

    Ok(Json(json!({
        "status": "success",
        "midterm_mode": midterm_mode
    })))
}
