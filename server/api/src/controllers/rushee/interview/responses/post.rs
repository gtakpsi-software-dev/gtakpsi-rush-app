use crate::models::rushee::PisResponse;
use crate::storage::db;
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::{doc, to_bson};
use serde_json::{json, Value};

// Replace PIS responses by clearing the array and appending each supplied answer in order.
pub async fn post_pis(
    Path(id): Path<String>,
    Json(payload): Json<Vec<PisResponse>>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_collection().await;

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
