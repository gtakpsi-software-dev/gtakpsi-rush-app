use super::average_rating_value;
use crate::controllers::db;
use crate::middlewares::{attendance, valid::check_valid_comment};
use crate::models::{
    misc::RushNight,
    rushee::{Comment, IncomingComment, Rating},
};
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::{doc, to_bson};
use serde_json::{json, Value};

/**
 * Post a new comment to some rushee
 * Uses timestamp to record date
 */
pub async fn post_comment(
    Path(id): Path<String>,
    Json(payload): Json<IncomingComment>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;
    let fetch_rush_nights = attendance::get_rush_nights().await;

    match fetch_rush_nights {
        Ok(rush_nights) => {
            let active_night = crate::middlewares::rush_nights::current_rush_night(
                &rush_nights,
                bson::DateTime::now(),
            );
            let active_night_name = match active_night {
                Some(n) => n.name,
                None => {
                    return Ok(Json(json!({
                        "status": "error",
                        "message": "no rush nights are configured"
                    })))
                }
            };
            for rush_night in rush_nights.iter() {
                if rush_night.name == active_night_name {
                    // found rush night
                    let attempt_bson_night = to_bson(&rush_night);
                    let mut bson_night;

                    match attempt_bson_night {
                        Ok(x) => {
                            bson_night = x;
                        }

                        Err(_err) => {
                            return Ok(Json(json!({
                                "status": "error",
                                "message": "some issue occurred when serializing the rush night"
                            })))
                        }
                    }

                    let my_rush_night = RushNight {
                        name: rush_night.name.clone(),
                        time: rush_night.time,
                    };

                    let new_comment = Comment {
                        brother_id: payload.brother_id.clone(),
                        brother_name: payload.brother_name.clone(),
                        comment: payload.comment.clone(),
                        ratings: payload.ratings.clone(),
                        night: my_rush_night.clone(),
                    };

                    // fetch the rushee
                    let get_rushee_result = connection.find_one(doc! {"gtid": id.clone()}).await;

                    match get_rushee_result {
                        Ok(rushee_option) => {
                            let mut rushee;

                            match rushee_option {
                                Some(x) => {
                                    rushee = x;
                                }
                                None => {
                                    return Ok(Json(json!({
                                        "status": "error",
                                        "message": "some error occurred"
                                    })))
                                }
                            }

                            // check if brother has already made a comment
                            let is_valid = check_valid_comment(
                                &payload.brother_name,
                                &my_rush_night,
                                &rushee.comments,
                            )
                            .await;

                            match is_valid {
                                Ok(_result) => {
                                    // do nothing
                                }

                                Err(_err) => {
                                    return Ok(Json(json!({
                                        "status": "error",
                                        "message": "you have already made a comment for this rush night"
                                    })))
                                }
                            }

                            // update ratings
                            for rating in payload.ratings.iter() {
                                let new_value = average_rating_value(
                                    &rushee.comments,
                                    &rating.name,
                                    Some(rating.value),
                                )
                                .unwrap_or(0.0);

                                let search_rating = rushee
                                    .ratings
                                    .iter()
                                    .find(|r: &&Rating| rating.name == r.name);

                                match search_rating {
                                    Some(_y) => {
                                        // Update existing rating
                                        let filter = doc! {
                                            "gtid": id.clone(),
                                            "ratings.name": rating.name.clone(),
                                        };
                                        let update = doc! {
                                            "$set": {
                                                "ratings.$.value": new_value,
                                            },
                                        };
                                        let update_result_try =
                                            connection.update_one(filter, update).await;

                                        match update_result_try {
                                            Ok(_update_result) => {
                                                // do nothing
                                            }
                                            Err(_err) => {
                                                return Ok(Json(json!({
                                                    "status": "error",
                                                    "message": "there was an error updating the rushee's global ratings"
                                                })))
                                            }
                                        }
                                    }
                                    None => {
                                        // **This is the important part for an empty array or new category**
                                        let filter = doc! {"gtid": id.clone()};
                                        let update = doc! {"$push": {"ratings": {"name": rating.name.clone(), "value": new_value}}};
                                        let update_result_try =
                                            connection.update_one(filter, update).await;

                                        match update_result_try {
                                            Ok(_update_result) => {
                                                // do nothing
                                            }
                                            Err(_err) => {
                                                return Ok(Json(json!({
                                                    "status": "error",
                                                    "message": "there was an error updating the rushee's global ratings"
                                                })))
                                            }
                                        }
                                    }
                                }
                            }

                            let mut bson_comment;
                            let mut bson_comment_try = to_bson(&new_comment);

                            match bson_comment_try {
                                Ok(x) => {
                                    bson_comment = x;
                                }
                                Err(err) => {
                                    return Ok(Json(json!({
                                        "status": "error",
                                        "message": "some error occurred"
                                    })))
                                }
                            }

                            let filter = doc! {"gtid": id};
                            let update = doc! {"$push": {
                                "comments": bson_comment,
                            }};

                            let result = connection.update_one(filter, update).await;

                            match result {
                                Ok(_update_result) => {
                                    return Ok(Json(json!({
                                        "status": "success",
                                        "message": "successfully updated rushee"
                                    })))
                                }

                                Err(_err) => {
                                    return Ok(Json(json!({
                                        "status": "error",
                                        "message": "something wrong occurred"
                                    })))
                                }
                            }
                        }

                        Err(_err) => {
                            return Ok(Json(json!({
                                "status": "error",
                                "message": "something wrong occurred"
                            })))
                        }
                    }
                }
            }

            return Ok(Json(json!({
                "status": "error",
                "message": "couldn't match a rush night"
            })));
        }

        Err(_err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "there was some error while matching the rush night"
            })))
        }
    }
}
