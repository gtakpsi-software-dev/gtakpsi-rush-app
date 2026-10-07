use crate::models::pis::PISAvailabilityFormStatus;
use crate::storage::db;
use axum::{http::StatusCode, response::Json};
use mongodb::{
    bson::{doc, DateTime},
    Collection,
};
use serde_json::{json, Value};

async fn replace_active_form(collection: &Collection<PISAvailabilityFormStatus>) -> bool {
    // INVARIANT: delete before insert; an insert failure leaves no active form.
    // The deletion error remains ignored to preserve the existing response path.
    let _ = collection.delete_many(doc! {}).await;

    let status = PISAvailabilityFormStatus {
        is_active: true,
        sent_at: Some(DateTime::now()),
    };

    collection.insert_one(status).await.is_ok()
}

pub async fn send_pis_availability_form() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_pis_availability_form_status_collection().await;

    if replace_active_form(&collection).await {
        Ok(Json(json!({
            "status": "success",
            "message": "PIS availability form sent to all brothers"
        })))
    } else {
        Ok(Json(json!({
            "status": "error",
            "message": "Failed to send form"
        })))
    }
}

pub async fn clear_and_resend_pis_availability_form() -> Result<Json<Value>, StatusCode> {
    // A failed submission clear must stop before the form status is replaced.
    let availability_collection = db::get_brother_pis_availability_collection().await;
    // Preserve the existing temporary drop order at this early return.
    #[allow(clippy::redundant_pattern_matching)]
    if let Err(_) = availability_collection.delete_many(doc! {}).await {
        return Ok(Json(json!({
            "status": "error",
            "message": "Failed to clear availability submissions"
        })));
    }

    // Keep status replacement after submission clearing.
    let form_collection = db::get_pis_availability_form_status_collection().await;

    if replace_active_form(&form_collection).await {
        Ok(Json(json!({
            "status": "success",
            "message": "Cleared all submissions and resent form"
        })))
    } else {
        Ok(Json(json!({
            "status": "error",
            "message": "Failed to resend form"
        })))
    }
}

pub async fn deactivate_pis_availability_form() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_pis_availability_form_status_collection().await;

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
