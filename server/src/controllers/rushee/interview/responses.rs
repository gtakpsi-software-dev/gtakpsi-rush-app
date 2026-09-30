use crate::controllers::db;
use crate::models::rushee::PisResponse;
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::{doc, to_bson};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/**
 * Post a Rushee's PIS
 */
pub async fn post_pis(
    Path(id): Path<String>,
    Json(payload): Json<Vec<PisResponse>>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    let mut filter;
    let mut update;

    // null out current entries
    filter = doc! {"gtid": id.clone()};
    update = doc! {"$set": doc! { "pis" : [] }};

    let clear_out_result = connection.update_one(filter, update).await;

    match clear_out_result {
        Ok(_clear_out) => {}

        Err(_err) => {
            return Ok(Json(json!({
                "status": "success",
                "message": "There was an error clearing out the current PIS responses"
            })))
        }
    }

    let mut pis_bson_try;
    let mut pis_bson;

    for response in payload.iter() {
        // push the pis response
        filter = doc! {"gtid": id.clone()};

        pis_bson_try = to_bson(&response);

        match pis_bson_try {
            Ok(x) => {
                pis_bson = x;
            }
            Err(err) => {
                return Ok(Json(json!({
                    "status": "error",
                    "message": "couldn't make the pis response into a bson file"
                })))
            }
        }

        update = doc! {
            "$push" : {
                "pis": pis_bson,
            }
        };

        let result = connection.update_one(filter, update).await;

        match result {
            Ok(update_result) => {
                // do nothing
            }

            Err(err) => {
                return Ok(Json(json!({
                    "status": "error",
                    "message": "failed to push a pis response"
                })))
            }
        }
    }

    Ok(Json(json!({
        "status": "success",
        "message": "succesfully stored rushee's pis"
    })))
}

/**
 * Autosave PIS - saves brothers and answers in one call
 */
#[derive(Deserialize, Serialize)]
pub struct PISAutosavePayload {
    pub pis_responses: Vec<PisResponse>,
    pub brother_a_first_name: String,
    pub brother_a_last_name: String,
    pub brother_b_first_name: String,
    pub brother_b_last_name: String,
}

pub async fn autosave_pis(
    Path(id): Path<String>,
    Json(payload): Json<PISAutosavePayload>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    // Convert PIS responses to BSON array
    let pis_bson_result = to_bson(&payload.pis_responses);
    let pis_bson = match pis_bson_result {
        Ok(b) => b,
        Err(_) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "Failed to convert PIS responses to BSON"
            })))
        }
    };

    // Update everything in one call
    let filter = doc! {"gtid": id.clone()};
    let update = doc! {
        "$set": {
            "pis": pis_bson,
            "pis_signup.first_brother_first_name": if payload.brother_a_first_name.trim().is_empty() { "none".to_string() } else { payload.brother_a_first_name.trim().to_string() },
            "pis_signup.first_brother_last_name": if payload.brother_a_last_name.trim().is_empty() { "none".to_string() } else { payload.brother_a_last_name.trim().to_string() },
            "pis_signup.second_brother_first_name": if payload.brother_b_first_name.trim().is_empty() { "none".to_string() } else { payload.brother_b_first_name.trim().to_string() },
            "pis_signup.second_brother_last_name": if payload.brother_b_last_name.trim().is_empty() { "none".to_string() } else { payload.brother_b_last_name.trim().to_string() },
        }
    };

    let result = connection.update_one(filter, update).await;

    match result {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "PIS autosaved successfully"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to autosave PIS"
        }))),
    }
}

#[cfg(test)]
mod tests;
