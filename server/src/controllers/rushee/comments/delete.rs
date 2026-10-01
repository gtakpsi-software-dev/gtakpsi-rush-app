use super::deletion_plan::rating_recalculations_after_deletion;
use crate::controllers::db;
use crate::models::rushee::Comment;
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::{doc, to_bson};
use serde_json::{json, Value};

pub async fn delete_comment(
    Path(id): Path<String>,
    Json(payload): Json<Comment>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    // First fetch the rushee data before deletion
    let fetch_filter = doc! {"gtid": id.clone()};
    let get_rushee_result = connection.find_one(fetch_filter).await;

    let mut rushee;
    match get_rushee_result {
        Ok(rushee_option) => match rushee_option {
            Some(x) => {
                rushee = x;
            }
            None => {
                return Ok(Json(json!({
                    "status": "error",
                    "message": "rushee not found"
                })))
            }
        },
        Err(_err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "error fetching rushee data"
            })))
        }
    }

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

    // Remove the comment
    let filter = doc! {"gtid": id.clone()};
    let update = doc! {
        "$pull": {
            "comments": {
                "brother_name": &payload.brother_name,
                "night": bson_night
            }
        }
    };
    let update_result = connection.update_one(filter, update).await;

    match update_result {
        Ok(_result) => {
            for (category, new_value) in
                rating_recalculations_after_deletion(rushee.comments, &payload)
            {
                if let Some(new_value) = new_value {
                    let rating_filter = doc! {"gtid": id.clone(), "ratings.name": &category};
                    let rating_update = doc! {
                        "$set": {
                            "ratings.$.value": new_value
                        }
                    };

                    let rating_update_result =
                        connection.update_one(rating_filter, rating_update).await;

                    match rating_update_result {
                        Ok(_) => {
                            // Success - continue to next category
                        }
                        Err(_err) => {
                            return Ok(Json(json!({
                                "status": "error",
                                "message": "error updating ratings after comment deletion"
                            })))
                        }
                    }
                } else {
                    // No remaining ratings for this category - remove it entirely
                    let rating_filter = doc! {"gtid": id.clone()};
                    let rating_update = doc! {
                        "$pull": {
                            "ratings": {
                                "name": &category
                            }
                        }
                    };

                    let rating_update_result =
                        connection.update_one(rating_filter, rating_update).await;

                    match rating_update_result {
                        Ok(_) => {
                            // Success - rating category removed
                        }
                        Err(_err) => {
                            return Ok(Json(json!({
                                "status": "error",
                                "message": "error removing rating category after comment deletion"
                            })))
                        }
                    }
                }
            }

            return Ok(Json(json!({
                "status": "success",
                "message": "successfully deleted comment and updated ratings"
            })));
        }

        Err(_err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "couldn't delete the comment from the database"
            })))
        }
    }
}
