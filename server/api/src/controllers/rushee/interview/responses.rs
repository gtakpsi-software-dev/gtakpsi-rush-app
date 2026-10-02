use crate::models::rushee::PisResponse;
use crate::storage::db;
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::{doc, to_bson};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub async fn post_pis(
    Path(id): Path<String>,
    Json(payload): Json<Vec<PisResponse>>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    // INVARIANT: keep clear and pushes as separate writes; later failures retain earlier pushes.
    let filter = doc! {"gtid": id.clone()};
    let update = doc! {"$set": doc! { "pis" : [] }};
    if connection.update_one(filter, update).await.is_err() {
        return Ok(Json(json!({
            "status": "success",
            "message": "There was an error clearing out the current PIS responses"
        })));
    }

    for response in &payload {
        let filter = doc! {"gtid": id.clone()};
        let pis_bson = match to_bson(&response) {
            Ok(value) => value,
            Err(_) => {
                return Ok(Json(json!({
                    "status": "error",
                    "message": "couldn't make the pis response into a bson file"
                })))
            }
        };

        let update = doc! {
            "$push" : {
                "pis": pis_bson,
            }
        };
        if connection.update_one(filter, update).await.is_err() {
            return Ok(Json(json!({
                "status": "error",
                "message": "failed to push a pis response"
            })));
        }
    }

    Ok(Json(json!({
        "status": "success",
        "message": "succesfully stored rushee's pis"
    })))
}

fn stored_brother_name(name: &str) -> String {
    // Blank names use the sentinel checked by existing assignment logic.
    let trimmed = name.trim();
    if trimmed.is_empty() {
        "none".to_string()
    } else {
        trimmed.to_string()
    }
}

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

    let pis_bson = match to_bson(&payload.pis_responses) {
        Ok(b) => b,
        Err(_) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "Failed to convert PIS responses to BSON"
            })))
        }
    };

    // Keep answers and brother names in one write so autosave stays atomic.
    let filter = doc! {"gtid": id.clone()};
    let update = doc! {
        "$set": {
            "pis": pis_bson,
            "pis_signup.first_brother_first_name": stored_brother_name(&payload.brother_a_first_name),
            "pis_signup.first_brother_last_name": stored_brother_name(&payload.brother_a_last_name),
            "pis_signup.second_brother_first_name": stored_brother_name(&payload.brother_b_first_name),
            "pis_signup.second_brother_last_name": stored_brother_name(&payload.brother_b_last_name),
        }
    };

    match connection.update_one(filter, update).await {
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
