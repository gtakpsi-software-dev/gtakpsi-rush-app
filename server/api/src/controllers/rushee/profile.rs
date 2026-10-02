use crate::controllers::db;
use crate::models::rushee::RusheeEdit;
use crate::services::validation;
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::doc;
use serde_json::{json, Value};

pub async fn update_cloud(
    Path(id): Path<String>,
    Json(payload): Json<String>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

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
    let connection = db::get_rushee_client().await;

    // Apply edits in order; a later invalid field leaves earlier writes committed.
    for edit in payload.iter() {
        if validation::pis_signup_synced_fields().contains(&edit.field) {
            let filter = doc! {"gtid": id.clone()};
            let update = doc! {
                "$set": {
                    edit.field.clone(): edit.new_value.clone(),
                    format!("pis_signup.rushee_{}", edit.field.clone()): edit.new_value.clone()
                }
            };

            if let Err(err) = connection.update_one(filter, update).await {
                return Ok(Json(json!({
                    "status": "error",
                    "message": err.to_string()
                })));
            }
        } else if validation::editable_rushee_fields().contains(&edit.field) {
            let filter = doc! {"gtid": id.clone()};
            let update = doc! {"$set": doc! { edit.field.clone(): edit.new_value.clone() }};

            if connection.update_one(filter, update).await.is_err() {
                return Ok(Json(json!({
                    "status": "error",
                    "message": "Some error occurred when updating the rushee"
                })));
            }
        } else {
            return Ok(Json(json!({
                "status": "error",
                "message": format!("Invalid rushee field passed in: {}", edit.field)
            })));
        }
    }

    Ok(Json(json!({
        "status": "success",
        "message": "Successfully updated all fields"
    })))
}
