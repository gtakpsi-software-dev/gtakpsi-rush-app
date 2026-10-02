use crate::models::rushee::Comment;
use crate::services::comment_ratings::{
    rating_recalculations_after_deletion, rating_update_for_deletion,
};
use crate::storage::db;
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::{doc, to_bson};
use serde_json::{json, Value};

fn deletion_error(message: &'static str) -> Result<Json<Value>, StatusCode> {
    Ok(Json(json!({ "status": "error", "message": message })))
}

pub async fn delete_comment(
    Path(id): Path<String>,
    Json(payload): Json<Comment>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_collection().await;

    let rushee = match connection.find_one(doc! { "gtid": id.clone() }).await {
        Ok(Some(rushee)) => rushee,
        Ok(None) => return deletion_error("rushee not found"),
        Err(_) => return deletion_error("error fetching rushee data"),
    };

    let bson_night = match to_bson(&payload.night) {
        Ok(night) => night,
        Err(_) => return deletion_error("there was an error bsonifying the night"),
    };

    let filter = doc! { "gtid": id.clone() };
    let update = doc! {
        "$pull": {
            "comments": {
                "brother_name": &payload.brother_name,
                "night": bson_night
            }
        }
    };
    // INVARIANT: rating writes follow the comment pull, preserving partial-write behavior.
    if connection.update_one(filter, update).await.is_err() {
        return deletion_error("couldn't delete the comment from the database");
    }

    for (category, new_value) in rating_recalculations_after_deletion(rushee.comments, &payload) {
        let (rating_filter, rating_update, error_message) =
            rating_update_for_deletion(&id, &category, new_value);

        if connection
            .update_one(rating_filter, rating_update)
            .await
            .is_err()
        {
            return deletion_error(error_message);
        }
    }

    Ok(Json(json!({
        "status": "success",
        "message": "successfully deleted comment and updated ratings"
    })))
}
