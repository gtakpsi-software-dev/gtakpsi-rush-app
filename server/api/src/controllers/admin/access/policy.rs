use crate::models::pis::CheckAccessPayload;
use crate::storage::db;
use axum::{http::StatusCode, response::Json};
use mongodb::bson::doc;
use serde_json::{json, Value};

/// Check if a brother can access the Rush App (public endpoint)
/// Admins always have access, regardless of disable settings
pub async fn check_rush_app_access(
    Json(payload): Json<CheckAccessPayload>,
) -> Result<Json<Value>, StatusCode> {
    // INVARIANT: admins retain access so they can restore disabled groups.
    if payload.is_admin {
        return Ok(Json(json!({
            "status": "success",
            "allowed": true,
            "reason": null
        })));
    }

    let collection = db::get_rush_app_status_collection().await;

    match collection.find_one(doc! {}).await {
        Ok(Some(status)) => {
            if payload.is_bidcom {
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

            if status.disable_regular {
                return Ok(Json(json!({
                    "status": "success",
                    "allowed": false,
                    "reason": "The Rush App has been temporarily disabled by an administrator."
                })));
            }

            Ok(Json(json!({
                "status": "success",
                "allowed": true,
                "reason": null
            })))
        }
        Ok(None) => Ok(Json(json!({
            "status": "success",
            "allowed": true,
            "reason": null
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to check access status"
        }))),
    }
}
