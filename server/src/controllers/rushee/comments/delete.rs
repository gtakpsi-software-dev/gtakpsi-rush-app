use super::is_modern_rating_value;
use crate::controllers::db;
use crate::middlewares::time_helpers::same_day;
use crate::models::rushee::Comment;
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::{doc, to_bson};
use serde_json::{json, Value};
use std::collections::HashSet;

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
            // Now recalculate ratings based on remaining comments
            // Filter out the deleted comment from our local copy
            let remaining_comments: Vec<Comment> = rushee
                .comments
                .into_iter()
                .filter(|comment| {
                    !(comment.brother_name == payload.brother_name
                        && same_day(&comment.night.time, &payload.night.time))
                })
                .collect();

            // Get all unique rating categories from deleted comment
            let mut rating_categories = HashSet::new();
            for rating in &payload.ratings {
                rating_categories.insert(rating.name.clone());
            }

            // Recalculate each rating category
            for category in rating_categories {
                let mut values = Vec::new();

                // Collect all remaining ratings for this category
                for comment in &remaining_comments {
                    if let Some(existing_rating) =
                        comment.ratings.iter().find(|r| r.name == category)
                    {
                        if is_modern_rating_value(existing_rating.value) {
                            values.push(existing_rating.value);
                        }
                    }
                }

                if !values.is_empty() {
                    // Calculate new average and update the rating
                    let new_value = values.iter().sum::<f32>() / values.len() as f32;

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
