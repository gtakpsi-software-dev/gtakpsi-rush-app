use crate::controllers::db;
use crate::middlewares::attendance;
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::doc;
use mongodb::bson::to_bson;
use serde_json::{json, Value};

/**
 * gets all rushees in the following form: {"id", "name", "picture", "ratings" ...} (only the info needed for the homepage)
 * filters are passed in through the header
 */
pub async fn get_rush_nights() -> Result<Json<Value>, StatusCode> {
    match attendance::get_rush_nights_sorted().await {
        Ok(nights) => Ok(Json(json!({
            "status": "success",
            "payload": nights
        }))),
        Err(_err) => Ok(Json(json!({
            "status": "error",
            "message": "could not load rush nights"
        }))),
    }
}

/**
 * Uses current time to stamp attendance
 */
pub async fn update_attendance(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let fetch_rush_nights = attendance::get_rush_nights().await;
    let connection = db::get_rushee_client().await;

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
            for candidate_night in rush_nights.iter() {
                if candidate_night.name == active_night_name {
                    // found rush night

                    let attempt_bson_night = to_bson(&candidate_night);
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

                    let filter = doc! {"gtid": id.clone()};
                    let update = doc! {"$addToSet": {
                        "attendance": bson_night,
                    }};

                    let result = connection.update_one(filter, update).await;

                    match result {
                        Ok(_update_result) => {
                            return Ok(Json(json!({
                                "status": "success",
                                "message": "updated rushee attendance"
                            })))
                        }

                        Err(_err) => {
                            return Ok(Json(json!({
                                "status": "error",
                                "message": "couldn't update rushee attendance"
                            })))
                        }
                    }
                }
            }

            return Ok(Json(json!({
                "status": "error",
                "message": "rush night does not exist"
            })));
        }

        Err(err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "some error occurred"
            })))
        }
    }
}
