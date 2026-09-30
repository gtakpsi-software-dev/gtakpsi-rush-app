use crate::controllers::db;
use crate::models::rushee::Comment;
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::{doc, to_bson};
use serde_json::{json, Value};

pub async fn edit_comment(
    Path(id): Path<String>,
    Json(payload): Json<Comment>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    let mut bson_night: bson::Bson;
    let bson_night_attempt = to_bson(&payload.night);

    match bson_night_attempt {
        Ok(x) => {
            bson_night = x;
        }

        Err(_error) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "there was an error bsonifying the night"
            })))
        }
    }

    let filter = doc! {
        "gtid": id.clone(),
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

    let edit_result = connection.update_one(filter, update).await;

    match edit_result {
        Ok(_edit) => {
            return Ok(Json(json!({
                "status": "success",
                "message": "updated comment successfully"
            })))
        }

        Err(_err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "there was an error pushing the update to the database"
            })))
        }
    }
}
