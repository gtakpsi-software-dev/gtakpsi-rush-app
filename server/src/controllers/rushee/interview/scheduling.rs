use crate::controllers::db;
use crate::middlewares::{pis, time_helpers};
use crate::models::pis::PISSignup;
use axum::{extract::Path, http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::doc;
use serde_json::{json, Value};

/**
 * Reschedule Rushee PIS
 * Accepts GTID as path param and new timeslot as body (ISO string)
 * Vacates old slot, takes new slot, updates rushee
 */
pub async fn reschedule_pis(
    Path(id): Path<String>,
    Json(payload): Json<String>,
) -> Result<Json<Value>, StatusCode> {
    let new_time = time_helpers::string_to_bson_datetime(&payload);
    let connection = db::get_rushee_client().await;

    // First, fetch the rushee to get their current timeslot
    let fetch_result = connection.find_one(doc! {"gtid": id.clone()}).await;

    let old_time = match fetch_result {
        Ok(Some(rushee)) => rushee.pis_timeslot,
        Ok(None) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "Rushee not found"
            })))
        }
        Err(_) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "Database error fetching rushee"
            })))
        }
    };

    // Vacate the OLD timeslot (free it up)
    let vacate_result = pis::vacate_pis_timeslot(old_time).await;
    match vacate_result {
        Ok(_) => {}
        Err(err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": format!("Failed to vacate old timeslot: {}", err)
            })))
        }
    }

    // Take the NEW timeslot
    let take_result = pis::take_pis_timeslot(new_time).await;
    match take_result {
        Ok(_) => {}
        Err(err) => {
            // Try to restore the old timeslot since we failed
            let _ = pis::take_pis_timeslot(old_time).await;
            return Ok(Json(json!({
                "status": "error",
                "message": format!("Failed to take new timeslot: {}", err)
            })));
        }
    }

    // Update the rushee's pis_timeslot and pis_signup.time
    let query = doc! {"gtid": id.clone()};
    let update = doc! {
        "$set": {
            "pis_timeslot": new_time,
            "pis_signup.time": new_time
        }
    };

    let update_result = connection.update_one(query, update).await;

    match update_result {
        Ok(_) => {
            return Ok(Json(json!({
                "status": "success",
                "message": "Successfully rescheduled PIS"
            })))
        }
        Err(_) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "Failed to update rushee record"
            })))
        }
    }
}

pub async fn get_signup_timeslots() -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    let result = connection
        .find({
            doc! {}
        })
        .await;

    match result {
        Ok(mut cursor) => {
            // TODO: extract useful info only
            let mut rushees = Vec::<PISSignup>::new();

            while let Some(rushee) = cursor.next().await {
                match rushee {
                    Ok(doc) => rushees.push(doc.pis_signup),
                    Err(err) => {
                        println!("{}", err.to_string());
                        return Ok(Json(json!({
                            "status": "error",
                            "message": "there was an error pushing the stripped rushee to the array"
                        })));
                    }
                }
            }

            Ok(Json(json!({
                "status": "success",
                "payload": rushees
            })))
        }

        Err(err) => Ok(Json(json!({
            "stauts": "error",
            "message": "some network error occurred"
        }))),
    }
}

/// Returns all PIS timeslots that have availability (num_available > 0)
pub async fn get_available_timeslots() -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_timeslots_client().await;

    // Filter for timeslots with num_available > 0
    let result = connection
        .find(doc! { "num_available": { "$gt": 0 } })
        .await;

    match result {
        Ok(mut cursor) => {
            let mut available_timeslots = Vec::<serde_json::Value>::new();

            while let Some(timeslot) = cursor.next().await {
                match timeslot {
                    Ok(doc) => {
                        available_timeslots.push(json!({
                            "time": doc.time,
                            "capacity": doc.num_available
                        }));
                    }
                    Err(err) => {
                        eprintln!("Error reading timeslot: {:?}", err);
                        return Ok(Json(json!({
                            "status": "error",
                            "message": "Error reading timeslot data"
                        })));
                    }
                }
            }

            // Sort by time
            available_timeslots.sort_by(|a, b| {
                let time_a = a["time"]["$date"]["$numberLong"]
                    .as_str()
                    .unwrap_or("0")
                    .parse::<i64>()
                    .unwrap_or(0);
                let time_b = b["time"]["$date"]["$numberLong"]
                    .as_str()
                    .unwrap_or("0")
                    .parse::<i64>()
                    .unwrap_or(0);
                time_a.cmp(&time_b)
            });

            Ok(Json(json!({
                "status": "success",
                "payload": available_timeslots
            })))
        }

        Err(err) => {
            eprintln!("Error fetching available timeslots: {:?}", err);
            Ok(Json(json!({
                "status": "error",
                "message": "Could not fetch available timeslots"
            })))
        }
    }
}
