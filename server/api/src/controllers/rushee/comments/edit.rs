use crate::models::rushee::Comment;
use crate::storage::db;
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::{doc, to_bson};
use serde_json::{json, Value};

pub async fn edit_comment(
    Path(id): Path<String>,
    Json(payload): Json<Comment>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    let bson_night = match to_bson(&payload.night) {
        Ok(night) => night,
        Err(_) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "there was an error bsonifying the night"
            })))
        }
    };

    let filter = doc! {
        "gtid": id,
        "comments": {
            "$elemMatch": {
                "brother_name": payload.brother_name,
                "night": bson_night,
            }
        }
    };

    let update = doc! {
        "$set": {
            "comments.$.comment": payload.comment
        }
    };

    // An acknowledged update reports success even when no comment matched.
    match connection.update_one(filter, update).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "updated comment successfully"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "there was an error pushing the update to the database"
        }))),
    }
}
