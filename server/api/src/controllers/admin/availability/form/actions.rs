use crate::controllers::db;
use crate::models::pis::PISAvailabilityFormStatus;
use axum::{http::StatusCode, response::Json};
use mongodb::bson::{doc, DateTime};
use serde_json::{json, Value};

pub async fn send_pis_availability_form() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_pis_availability_form_status_client().await;

    // Preserve the existing replacement order and ignored deletion error before inserting the active form.
    let _ = collection.delete_many(doc! {}).await;

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

pub async fn clear_and_resend_pis_availability_form() -> Result<Json<Value>, StatusCode> {
    // A failed submission clear must stop before the form status is replaced.
    let availability_collection = db::get_brother_pis_availability_client().await;
    if let Err(_) = availability_collection.delete_many(doc! {}).await {
        return Ok(Json(json!({
            "status": "error",
            "message": "Failed to clear availability submissions"
        })));
    }

    // Keep status replacement after submission clearing; this deletion's error remains ignored.
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
