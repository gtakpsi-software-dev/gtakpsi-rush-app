use crate::controllers::db;
use crate::models::pis::{CheckAccessPayload, RushAppStatus, UpdateRushAppPayload};
use axum::extract::Extension;
use axum::{http::StatusCode, response::Json};
use mongodb::bson::{doc, DateTime};
use serde_json::{json, Value};

// ========== Rush App Disable System Endpoints ==========

/// Update Rush App access settings (independent toggles for bidcom and regular brothers)
pub async fn update_rush_app_settings(
    Extension(user): Extension<crate::middlewares::auth::FirebaseUser>,
    Json(payload): Json<UpdateRushAppPayload>,
) -> Result<Json<Value>, StatusCode> {
    let collection = db::get_rush_app_status_client().await;

    // Delete any existing status document
    let _ = collection.delete_many(doc! {}).await;

    // Insert new status
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
    let collection = db::get_rush_app_status_client().await;

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
    let collection = db::get_rush_app_status_client().await;

    match collection.find_one(doc! {}).await {
        Ok(Some(status)) => Ok(Json(json!({
            "status": "success",
            "midterm_mode": status.midterm_mode
        }))),
        Ok(None) => Ok(Json(json!({
            "status": "success",
            "midterm_mode": false
        }))),
        Err(_) => Ok(Json(json!({
            "status": "success",
            "midterm_mode": false
        }))),
    }
}

/// Check if a brother can access the Rush App (public endpoint)
/// Admins always have access, regardless of disable settings
pub async fn check_rush_app_access(
    Json(payload): Json<CheckAccessPayload>,
) -> Result<Json<Value>, StatusCode> {
    // Admins always have access
    if payload.is_admin {
        return Ok(Json(json!({
            "status": "success",
            "allowed": true,
            "reason": null
        })));
    }

    let collection = db::get_rush_app_status_client().await;

    match collection.find_one(doc! {}).await {
        Ok(Some(status)) => {
            // Check if user is bid committee (but not admin - already checked above)
            if payload.is_bidcom {
                // User is bid committee member
                if status.disable_bidcom {
                    return Ok(Json(json!({
                        "status": "success",
                        "allowed": false,
                        "reason": "The Rush App has been temporarily disabled for bid committee members."
                    })));
                } else {
                    return Ok(Json(json!({
                        "status": "success",
                        "allowed": true,
                        "reason": null
                    })));
                }
            }

            // User is a regular brother (not admin, not bidcom)
            if status.disable_regular {
                return Ok(Json(json!({
                    "status": "success",
                    "allowed": false,
                    "reason": "The Rush App has been temporarily disabled by an administrator."
                })));
            }

            // Not disabled for this user type
            Ok(Json(json!({
                "status": "success",
                "allowed": true,
                "reason": null
            })))
        }
        Ok(None) => {
            // No status document means app is enabled for everyone
            Ok(Json(json!({
                "status": "success",
                "allowed": true,
                "reason": null
            })))
        }
        Err(_) => {
            // On error, allow access to be safe
            Ok(Json(json!({
                "status": "error",
                "message": "Failed to check access status"
            })))
        }
    }
}
