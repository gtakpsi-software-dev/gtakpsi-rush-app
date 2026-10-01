use axum::{http::StatusCode, response::Json};
use mongodb::bson::doc;
use serde_json::{json, Value};

use crate::controllers::db;

/// Clear all brother assignments from PIS slots
pub async fn clear_pis_assignments() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_rushee_client().await;

    // INVARIANT: clear both slots' first and last names together; a partial
    // reset would leave later assignment runs with inconsistent occupancy.
    let update = doc! {
        "$set": {
            "pis_signup.first_brother_first_name": "none",
            "pis_signup.first_brother_last_name": "none",
            "pis_signup.second_brother_first_name": "none",
            "pis_signup.second_brother_last_name": "none"
        }
    };

    match collection.update_many(doc! {}, update).await {
        Ok(result) => Ok(Json(json!({
            "status": "success",
            "message": format!("Cleared assignments from {} rushees", result.modified_count)
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to clear assignments"
        }))),
    }
}
