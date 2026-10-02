use crate::controllers::db;
use crate::models::pis::{BrotherPISAvailability, IncomingBrotherAvailability};
use crate::services::rush_time::string_to_bson_datetime;
use axum::{http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::{doc, DateTime};
use serde_json::{json, Value};

/// Submit brother's PIS availability
pub async fn submit_brother_availability(
    Json(payload): Json<IncomingBrotherAvailability>,
) -> Result<Json<Value>, StatusCode> {
    let collection = db::get_brother_pis_availability_client().await;

    let timeslots: Vec<DateTime> = payload
        .available_timeslots
        .iter()
        .map(|t| string_to_bson_datetime(t))
        .collect();

    let availability = BrotherPISAvailability {
        brother_uid: payload.brother_uid.clone(),
        brother_email: payload.brother_email,
        brother_first_name: payload.brother_first_name,
        brother_last_name: payload.brother_last_name,
        available_timeslots: timeslots,
        submitted_at: DateTime::now(),
    };

    // Replace by brother UID, retaining the existing ignored delete error.
    // An insert failure after deletion leaves that brother without a submission.
    let filter = doc! { "brother_uid": &payload.brother_uid };
    let _ = collection.delete_one(filter).await;

    match collection.insert_one(availability).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "Availability submitted successfully"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to submit availability"
        }))),
    }
}

/// Get all brother availabilities (admin view)
pub async fn get_all_brother_availabilities() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_brother_pis_availability_client().await;

    match collection.find(doc! {}).await {
        Ok(mut cursor) => {
            let mut availabilities: Vec<BrotherPISAvailability> = Vec::new();
            while let Some(item) = cursor.next().await {
                if let Ok(avail) = item {
                    availabilities.push(avail);
                }
            }
            Ok(Json(json!({
                "status": "success",
                "payload": availabilities
            })))
        }
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to fetch availabilities"
        }))),
    }
}
