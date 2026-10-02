use crate::storage::db;
use axum::{http::StatusCode, response::Json};
use mongodb::bson::doc;
use serde::Deserialize;
use serde_json::{json, Value};

pub async fn get_pis_availability_form_status() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_pis_availability_form_status_collection().await;

    match collection.find_one(doc! {}).await {
        Ok(Some(status)) => Ok(Json(json!({
            "status": "success",
            "is_active": status.is_active,
            "sent_at": status.sent_at
        }))),
        Ok(None) => Ok(Json(json!({
            "status": "success",
            "is_active": false,
            "sent_at": null
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to check form status"
        }))),
    }
}

#[derive(Deserialize)]
pub struct CheckBrotherAvailabilityPayload {
    pub brother_uid: String,
}

pub async fn check_brother_needs_availability_form(
    Json(payload): Json<CheckBrotherAvailabilityPayload>,
) -> Result<Json<Value>, StatusCode> {
    // Missing or inactive forms never require a submission, so skip the brother lookup.
    let form_collection = db::get_pis_availability_form_status_collection().await;
    let form_status = match form_collection.find_one(doc! {}).await {
        Ok(Some(status)) => status,
        Ok(None) => {
            return Ok(Json(json!({
                "status": "success",
                "needs_form": false
            })));
        }
        Err(_) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "Failed to check form status"
            })));
        }
    };

    if !form_status.is_active {
        return Ok(Json(json!({
            "status": "success",
            "needs_form": false
        })));
    }

    let availability_collection = db::get_brother_pis_availability_collection().await;
    match availability_collection
        .find_one(doc! { "brother_uid": &payload.brother_uid })
        .await
    {
        Ok(Some(_)) => Ok(Json(json!({
            "status": "success",
            "needs_form": false
        }))),
        Ok(None) => Ok(Json(json!({
            "status": "success",
            "needs_form": true
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to check availability"
        }))),
    }
}
