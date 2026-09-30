use crate::controllers::db;
use crate::middlewares::valid;
use crate::models::rushee::RusheeEdit;
use axum::{extract::Path, http::StatusCode, response::Json};
use bson::Document;
use mongodb::bson::doc;
use serde_json::{json, Value};

/**
 * Update the cloud the rushee is in
 */
pub async fn update_cloud(
    Path(id): Path<String>,
    Json(payload): Json<String>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    let filter = doc! {"_id": id};
    let update = doc! {"$set": doc! {"cloud": payload}};

    let result = connection.update_one(filter, update).await;

    match result {
        Ok(update_result) => Ok(Json(json!({
            "status": "success",
            "message": "sucessfully updated rushee cloud"
        }))),

        Err(err) => Ok(Json(json!({
            "status": "error",
            "message": "did not update cloud"
        }))),
    }
}

/**
 * Update rushee (edit rushee's attributes)
 */
pub async fn update_rushee(
    Path(id): Path<String>,
    Json(payload): Json<Vec<RusheeEdit>>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    let mut filter: Document;
    let mut update: Document;

    for edit in payload.iter() {
        if valid::get_pis_signup_breaking_changes().contains(&edit.field) {
            filter = doc! {"gtid": id.clone()};
            update = doc! {
                "$set": {
                    edit.field.clone(): edit.new_value.clone(),
                    format!("pis_signup.rushee_{}", edit.field.clone()): edit.new_value.clone()
                }
            };

            let result = connection.update_one(filter, update).await;

            match result {
                Ok(_update_reult) => {
                    // do nothing
                }

                Err(err) => {
                    return Ok(Json(json!({
                        "status": "error",
                        "message": err.to_string()
                    })))
                }
            }
        } else if valid::get_rushee_edit_fields().contains(&edit.field) {
            filter = doc! {"gtid": id.clone()};
            update = doc! {"$set": doc! { edit.field.clone(): edit.new_value.clone() }};

            let result = connection.update_one(filter, update).await;

            match result {
                Ok(_update_reult) => {
                    // do nothing
                }

                Err(_err) => {
                    return Ok(Json(json!({
                        "status": "error",
                        "message": "Some error occurred when updating the rushee"
                    })))
                }
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
