use crate::controllers::db;
use crate::middlewares::attendance;
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::doc;
use mongodb::bson::to_bson;
use serde_json::{json, Value};

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
                    let bson_night = match to_bson(&candidate_night) {
                        Ok(night) => night,
                        Err(_) => {
                            return Ok(Json(json!({
                                "status": "error",
                                "message": "some issue occurred when serializing the rush night"
                            })))
                        }
                    };

                    let filter = doc! {"gtid": id.clone()};
                    let update = doc! {"$addToSet": {
                        "attendance": bson_night,
                    }};

                    let result = connection.update_one(filter, update).await;

                    match result {
                        // A successful write keeps the established response even if no GTID matched.
                        Ok(_) => {
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

        Err(_) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "some error occurred"
            })))
        }
    }
}
