use crate::controllers::db;
use crate::middlewares::time_helpers::string_to_bson_datetime;
use crate::models::pis::{
    BrotherPISAvailability, IncomingBrotherAvailability, PISAvailabilityFormStatus,
};
use axum::{http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::doc;
use mongodb::bson::DateTime;
use serde::Deserialize;
use serde_json::{json, Value};

// ========== PIS Availability System Endpoints ==========

/// Send the PIS availability form to all brothers (activate form)
pub async fn send_pis_availability_form() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_pis_availability_form_status_client().await;

    // Delete any existing status document
    let _ = collection.delete_many(doc! {}).await;

    // Insert new active status
    let status = PISAvailabilityFormStatus {
        is_active: true,
        sent_at: Some(DateTime::now()),
    };

    match collection.insert_one(status).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "PIS availability form sent to all brothers"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to send form"
        }))),
    }
}

/// Clear all availability submissions and resend the form
pub async fn clear_and_resend_pis_availability_form() -> Result<Json<Value>, StatusCode> {
    // Clear all brother availability submissions
    let availability_collection = db::get_brother_pis_availability_client().await;
    if let Err(_) = availability_collection.delete_many(doc! {}).await {
        return Ok(Json(json!({
            "status": "error",
            "message": "Failed to clear availability submissions"
        })));
    }

    // Reset and activate the form
    let form_collection = db::get_pis_availability_form_status_client().await;
    let _ = form_collection.delete_many(doc! {}).await;

    let status = PISAvailabilityFormStatus {
        is_active: true,
        sent_at: Some(DateTime::now()),
    };

    match form_collection.insert_one(status).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "Cleared all submissions and resent form"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to resend form"
        }))),
    }
}

/// Check if the PIS availability form is currently active
pub async fn get_pis_availability_form_status() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_pis_availability_form_status_client().await;

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

/// Check if a specific brother needs to fill out the availability form
#[derive(Deserialize)]
pub struct CheckBrotherAvailabilityPayload {
    pub brother_uid: String,
}

pub async fn check_brother_needs_availability_form(
    Json(payload): Json<CheckBrotherAvailabilityPayload>,
) -> Result<Json<Value>, StatusCode> {
    // First check if form is active
    let form_collection = db::get_pis_availability_form_status_client().await;
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

    // Check if brother has already submitted
    let availability_collection = db::get_brother_pis_availability_client().await;
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

/// Submit brother's PIS availability
pub async fn submit_brother_availability(
    Json(payload): Json<IncomingBrotherAvailability>,
) -> Result<Json<Value>, StatusCode> {
    let collection = db::get_brother_pis_availability_client().await;

    // Convert timeslot strings to DateTime
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

    // Upsert - update if exists, insert if not
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

/// Deactivate the PIS availability form
pub async fn deactivate_pis_availability_form() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_pis_availability_form_status_client().await;

    let update = doc! { "$set": { "is_active": false } };

    match collection.update_many(doc! {}, update).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "Form deactivated"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to deactivate form"
        }))),
    }
}
