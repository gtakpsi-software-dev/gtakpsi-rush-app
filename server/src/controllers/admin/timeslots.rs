use axum::{http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::{doc, Document};
use serde_json::{json, Value};

use crate::controllers::db;
use crate::middlewares::time_helpers;
use crate::models::pis::{PISTimeslot, PISTimeslotIncoming};

fn incoming_time_filter(time: &str) -> Document {
    // INVARIANT: existing-slot updates and deletion lookups use the incoming string.
    // Stored times are BSON dates, so changing this filter changes current API results.
    doc! {"time": time}
}

fn timeslot_message(status: &str, message: &str) -> Json<Value> {
    Json(json!({"status": status, "message": message}))
}

pub async fn add_pis_timeslot(
    Json(payload): Json<PISTimeslotIncoming>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_timeslots_client().await;
    let time = time_helpers::string_to_bson_datetime(&payload.time);

    let existing = match connection.find_one(doc! {"time": time}).await {
        Ok(timeslot) => timeslot,
        Err(_) => {
            return Ok(timeslot_message("error", "some error occurred"));
        }
    };

    if let Some(timeslot) = existing {
        let update_filter = incoming_time_filter(&payload.time);
        let update = doc! {"$set": {
            "num_available": timeslot.num_available + payload.change
        }};

        return match connection.update_one(update_filter, update).await {
            Ok(_) => Ok(timeslot_message(
                "success",
                "added to num_available timeslots",
            )),
            Err(_) => Ok(timeslot_message("error", "some error occurred")),
        };
    }

    let new_pis_timeslot = PISTimeslot {
        time,
        num_available: payload.change,
    };
    match connection.insert_one(new_pis_timeslot).await {
        Ok(_) => Ok(timeslot_message(
            "success",
            "successfully created new pis timeslot",
        )),
        Err(_) => Ok(timeslot_message(
            "error",
            "some error occurred while creating the PIS timeslot",
        )),
    }
}

pub async fn delete_pis_timeslot(
    Json(payload): Json<PISTimeslotIncoming>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_timeslots_client().await;
    let time = time_helpers::string_to_bson_datetime(&payload.time);

    let existing = match connection
        .find_one(incoming_time_filter(&payload.time))
        .await
    {
        Ok(Some(timeslot)) => timeslot,
        Ok(None) => {
            return Ok(timeslot_message("error", "pis timeslot doesn't exist"));
        }
        Err(_) => {
            return Ok(timeslot_message("error", "some error occurred"));
        }
    };

    if existing.num_available < payload.change {
        return match connection.delete_one(doc! {"time": time}).await {
            Ok(_) => Ok(timeslot_message("success", "successfully deleted timeslot")),
            Err(_) => Ok(timeslot_message("error", "couldn't delete timeslot")),
        };
    }

    let update = doc! {"$set": {
        "num_available": existing.num_available + payload.change
    }};
    match connection.update_one(doc! {"time": time}, update).await {
        Ok(_) => Ok(timeslot_message(
            "success",
            "subtracted from num_available timeslots",
        )),
        Err(_) => Ok(timeslot_message("error", "some error occurred")),
    }
}

pub async fn get_pis_timeslots() -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_timeslots_client().await;
    let mut cursor = match connection.find(doc! {}).await {
        Ok(cursor) => cursor,
        Err(_) => {
            return Ok(timeslot_message(
                "error",
                "some error occurred while fetching data",
            ));
        }
    };

    let mut pis_timeslots: Vec<PISTimeslot> = Vec::new();
    while let Some(timeslot) = cursor.next().await {
        match timeslot {
            Ok(doc) => pis_timeslots.push(doc),
            Err(_) => {
                return Ok(timeslot_message("error", "some error occurred"));
            }
        }
    }

    Ok(Json(json!({
        "status": "success",
        "payload": pis_timeslots
    })))
}
