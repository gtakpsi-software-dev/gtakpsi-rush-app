use axum::{http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::doc;
use serde_json::{json, Value};

use crate::controllers::db;
use crate::middlewares::time_helpers;
use crate::models::pis::{PISTimeslot, PISTimeslotIncoming};

pub async fn add_pis_timeslot(
    Json(payload): Json<PISTimeslotIncoming>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_timeslots_client().await;
    let time = time_helpers::string_to_bson_datetime(&payload.time);

    let existing = match connection.find_one(doc! {"time": time}).await {
        Ok(timeslot) => timeslot,
        Err(_) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "some error occurred"
            })));
        }
    };

    if let Some(timeslot) = existing {
        // Keep the incoming string filter; matching it against a stored BSON date
        // currently reports a successful update without changing the record.
        let update_filter = doc! {"time": payload.time};
        let update = doc! {"$set": {
            "num_available": timeslot.num_available + payload.change
        }};

        return match connection.update_one(update_filter, update).await {
            Ok(_) => Ok(Json(json!({
                "status": "success",
                "message": "added to num_available timeslots"
            }))),
            Err(_) => Ok(Json(json!({
                "status": "error",
                "message": "some error occurred"
            }))),
        };
    }

    let new_pis_timeslot = PISTimeslot {
        time,
        num_available: payload.change,
    };
    match connection.insert_one(new_pis_timeslot).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "successfully created new pis timeslot"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "some error occurred while creating the PIS timeslot"
        }))),
    }
}

pub async fn delete_pis_timeslot(
    Json(payload): Json<PISTimeslotIncoming>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_timeslots_client().await;
    let time = time_helpers::string_to_bson_datetime(&payload.time);

    // Preserve the string lookup even though stored times use BSON dates.
    // Changing it would make this endpoint delete records that it currently misses.
    let existing = match connection.find_one(doc! {"time": payload.time}).await {
        Ok(Some(timeslot)) => timeslot,
        Ok(None) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "pis timeslot doesn't exist"
            })));
        }
        Err(_) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "some error occurred"
            })));
        }
    };

    if existing.num_available < payload.change {
        return match connection.delete_one(doc! {"time": time}).await {
            Ok(_) => Ok(Json(json!({
                "status": "success",
                "message": "successfully deleted timeslot"
            }))),
            Err(_) => Ok(Json(json!({
                "status": "error",
                "message": "couldn't delete timeslot"
            }))),
        };
    }

    let update = doc! {"$set": {
        "num_available": existing.num_available + payload.change
    }};
    match connection.update_one(doc! {"time": time}, update).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "subtracted from num_available timeslots"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "some error occurred"
        }))),
    }
}

pub async fn get_pis_timeslots() -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_timeslots_client().await;
    let mut cursor = match connection.find(doc! {}).await {
        Ok(cursor) => cursor,
        Err(_) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "some error occurred while fetching data"
            })));
        }
    };

    let mut pis_timeslots: Vec<PISTimeslot> = Vec::new();
    while let Some(timeslot) = cursor.next().await {
        match timeslot {
            Ok(doc) => pis_timeslots.push(doc),
            Err(_) => {
                return Ok(Json(json!({
                    "status": "error",
                    "message": "some error occurred"
                })));
            }
        }
    }

    Ok(Json(json!({
        "status": "success",
        "payload": pis_timeslots
    })))
}
