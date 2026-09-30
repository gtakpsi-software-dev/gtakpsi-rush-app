use axum::{http::StatusCode, response::Json};
use mongodb::bson::doc;
use serde_json::{json, Value};

use crate::controllers::db;
use crate::middlewares::time_helpers;
use crate::models::pis::{PISTimeslot, PISTimeslotIncoming};
use futures::stream::StreamExt;

/**
 * Add a certain number of PIS timeslots
 * Input must be formatted as a bson DateTime object
 */
pub async fn add_pis_timeslot(
    Json(payload): Json<PISTimeslotIncoming>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_timeslots_client().await;

    let time = time_helpers::string_to_bson_datetime(&payload.time);

    // check if timeslot exists
    let filter = doc! {"time": time};
    let result = connection.find_one(filter).await;

    match result {
        Ok(find_result) => match find_result {
            Some(timeslot) => {
                let update_filter = doc! {"time": payload.time};
                let update = doc! {"$set": doc! {
                    "num_available": timeslot.num_available + payload.change
                }};

                let update_result = connection.update_one(update_filter, update).await;

                match update_result {
                    Ok(_x) => {
                        return Ok(Json(json!({
                            "status": "success",
                            "message": "added to num_available timeslots"
                        })))
                    }

                    Err(_err) => {
                        return Ok(Json(json!({
                            "status": "error",
                            "message": "some error occurred"
                        })))
                    }
                }
            }

            None => {
                let new_pis_timeslot = PISTimeslot {
                    time: time,
                    num_available: payload.change,
                };

                let add_result = connection.insert_one(new_pis_timeslot).await;

                match add_result {
                    Ok(_x) => {
                        return Ok(Json(json!({
                            "status": "success",
                            "message": "successfully created new pis timeslot"
                        })))
                    }
                    Err(_err) => {
                        return Ok(Json(json!({
                            "status": "error",
                            "message": "some error occurred while creating the PIS timeslot"
                        })))
                    }
                }
            }
        },

        Err(_err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "some error occurred"
            })))
        }
    }
}

/**
 * Delete a certain number of PIS timeslots
 * NOTE: If final number is negative, the timeslot is deleted
 */
pub async fn delete_pis_timeslot(
    Json(payload): Json<PISTimeslotIncoming>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_timeslots_client().await;

    let time = time_helpers::string_to_bson_datetime(&payload.time);

    // check if timeslot exists
    let filter = doc! {"time": payload.time};
    let result = connection.find_one(filter).await;

    match result {
        Ok(find_result) => match find_result {
            Some(timeslot) => {
                if timeslot.num_available < payload.change {
                    // delete timeslot
                    let delete_filter = doc! {"time": time};

                    let delete_result = connection.delete_one(delete_filter).await;

                    match delete_result {
                        Ok(_x) => Ok(Json(json!({
                            "status": "success",
                            "message": "successfully deleted timeslot"
                        }))),

                        Err(_err) => Ok(Json(json!({
                            "status": "error",
                            "message": "couldn't delete timeslot"
                        }))),
                    }
                } else {
                    let update_filter = doc! {"time": time};
                    let update = doc! {"$set": doc! {
                        "num_available": timeslot.num_available + payload.change
                    }};

                    let update_result = connection.update_one(update_filter, update).await;

                    match update_result {
                        Ok(_x) => {
                            return Ok(Json(json!({
                                "status": "success",
                                "message": "subtracted from num_available timeslots"
                            })))
                        }

                        Err(_err) => {
                            return Ok(Json(json!({
                                "status": "error",
                                "message": "some error occurred"
                            })))
                        }
                    }
                }
            }

            None => {
                return Ok(Json(json!({
                    "status": "error",
                    "message": "pis timeslot doesn't exist"
                })))
            }
        },

        Err(_err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "some error occurred"
            })))
        }
    }
}

/**
 * Fetch all the PIS timeslots
 */
pub async fn get_pis_timeslots() -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_timeslots_client().await;

    let result = connection.find(doc! {}).await;

    match result {
        Ok(mut cursor) => {
            let mut pis_timeslots: Vec<PISTimeslot> = Vec::new();

            while let Some(timeslot) = cursor.next().await {
                match timeslot {
                    Ok(doc) => pis_timeslots.push(doc),
                    Err(err) => {
                        return Ok(Json(json!({
                            "status": "error",
                            "message": "some error occurred"
                        })))
                    }
                }
            }

            Ok(Json(json!({
                "status": "success",
                "payload": pis_timeslots
            })))
        }

        Err(err) => Ok(Json(json!({
            "status": "error",
            "message": "some error occurred while fetching data"
        }))),
    }
}
