use crate::services::pis_timeslot_sort::sort_available_timeslots;
use crate::storage::{cursor_rows::for_each_strict_row, db};
use axum::{http::StatusCode, response::Json};
use mongodb::bson::doc;
use serde_json::{json, Value};

use super::super::read_rows::map_rushee_rows;

pub async fn get_signup_timeslots() -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_collection().await;
    match map_rushee_rows(connection, |rushee| rushee.pis_signup).await {
        Ok(payload) => Ok(Json(json!({"status": "success", "payload": payload}))),
        Err(response) => Ok(response),
    }
}

/// Returns all PIS timeslots that have availability (num_available > 0)
pub async fn get_available_timeslots() -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_timeslots_collection().await;

    // Filter for timeslots with num_available > 0
    let result = connection
        .find(doc! { "num_available": { "$gt": 0 } })
        .await;

    match result {
        Ok(cursor) => {
            let mut available_timeslots = Vec::<serde_json::Value>::new();

            if let Err(err) = for_each_strict_row(cursor, |doc| {
                available_timeslots.push(json!({
                    "time": doc.time,
                    "capacity": doc.num_available
                }));
            })
            .await
            {
                eprintln!("Error reading timeslot: {err:?}");
                return Ok(Json(json!({
                    "status": "error",
                    "message": "Error reading timeslot data"
                })));
            }

            sort_available_timeslots(&mut available_timeslots);

            Ok(Json(json!({
                "status": "success",
                "payload": available_timeslots
            })))
        }

        Err(err) => {
            eprintln!("Error fetching available timeslots: {err:?}");
            Ok(Json(json!({
                "status": "error",
                "message": "Could not fetch available timeslots"
            })))
        }
    }
}
