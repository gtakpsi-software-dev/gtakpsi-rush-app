use axum::{http::StatusCode, response::Json};
use mongodb::bson::{doc, Document};
use serde_json::{json, Value};

use crate::models::pis::{PISTimeslot, PISTimeslotIncoming};
use crate::services::rush_time;
use crate::storage::{cursor_rows::collect_strict_rows, db};

mod delete;
pub use delete::delete_pis_timeslot;

// Build the string-based timestamp filter used by timeslot mutations.
fn incoming_time_filter(time: &str) -> Document {
    // INVARIANT: existing-slot updates and deletion lookups use the incoming string.
    // Stored times are BSON dates, so changing this filter changes current API results.
    doc! {"time": time}
}

// Build a timeslot response containing a status and message.
fn timeslot_message(status: &str, message: &str) -> Json<Value> {
    Json(json!({"status": status, "message": message}))
}

// Create a timeslot or attempt to adjust the capacity of an existing one.
pub async fn add_pis_timeslot(
    Json(payload): Json<PISTimeslotIncoming>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_timeslots_collection().await;
    let time = rush_time::string_to_bson_datetime(&payload.time);

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

// Return all PIS timeslots, reporting query or row-decoding failures.
pub async fn get_pis_timeslots() -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_timeslots_collection().await;
    let cursor = match connection.find(doc! {}).await {
        Ok(cursor) => cursor,
        Err(_) => {
            return Ok(timeslot_message(
                "error",
                "some error occurred while fetching data",
            ));
        }
    };

    let pis_timeslots: Vec<PISTimeslot> = match collect_strict_rows(cursor).await {
        Ok(timeslots) => timeslots,
        Err(_) => return Ok(timeslot_message("error", "some error occurred")),
    };

    Ok(Json(json!({
        "status": "success",
        "payload": pis_timeslots
    })))
}

#[cfg(test)]
mod tests {
    use super::incoming_time_filter;
    use mongodb::bson::doc;

    // Verify that mutation filters retain the incoming timestamp as a string.
    #[test]
    fn incoming_time_lookup_retains_a_string_value() {
        assert_eq!(
            incoming_time_filter("2026-10-01T12:00:00Z"),
            doc! {"time": "2026-10-01T12:00:00Z"}
        );
    }
}
