use crate::models::rushee::RusheeEdit;
use crate::services::validation;
use crate::storage::db;
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::doc;
use serde_json::{json, Value};

pub async fn update_cloud(
    Path(id): Path<String>,
    Json(payload): Json<String>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_collection().await;

    // Keep the original `_id` lookup and success-on-no-match contract during this refactor.
    // Registered rushees are normally addressed elsewhere by GTID.
    let filter = doc! {"_id": id};
    let update = doc! {"$set": doc! {"cloud": payload}};

    let result = connection.update_one(filter, update).await;

    match result {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "sucessfully updated rushee cloud"
        }))),

        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "did not update cloud"
        }))),
    }
}

pub async fn update_rushee(
    Path(id): Path<String>,
    Json(payload): Json<Vec<RusheeEdit>>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_collection().await;

    // Apply edits in order; a later invalid field leaves earlier writes committed.
    for edit in payload.iter() {
        let synced = validation::is_pis_signup_synced_field(&edit.field);
        let update = if synced {
            doc! {
                "$set": {
                    edit.field.clone(): edit.new_value.clone(),
                    format!("pis_signup.rushee_{}", edit.field.clone()): edit.new_value.clone()
                }
            }
        } else if validation::is_editable_rushee_field(&edit.field) {
            doc! {"$set": doc! { edit.field.clone(): edit.new_value.clone() }}
        } else {
            return Ok(Json(json!({
                "status": "error",
                "message": format!("Invalid rushee field passed in: {}", edit.field)
            })));
        };

        let filter = doc! {"gtid": id.clone()};
        if let Err(err) = connection.update_one(filter, update).await {
            let message = if synced {
                err.to_string()
            } else {
                "Some error occurred when updating the rushee".to_string()
            };
            return Ok(Json(json!({
                "status": "error",
                "message": message
            })));
        }
    }

    Ok(Json(json!({
        "status": "success",
        "message": "Successfully updated all fields"
    })))
}
