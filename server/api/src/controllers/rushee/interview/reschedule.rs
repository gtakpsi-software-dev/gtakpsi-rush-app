use crate::services::pis_capacity;
use crate::services::rush_time;
use crate::storage::db;
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::doc;
use serde_json::{json, Value};

// Transfer timeslot capacity and update the rushee's PIS time and signup time.
pub async fn reschedule_pis(
    Path(id): Path<String>,
    Json(payload): Json<String>,
) -> Result<Json<Value>, StatusCode> {
    let new_time = rush_time::string_to_bson_datetime(&payload);
    let connection = db::get_rushee_collection().await;

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

    // Release old capacity first; restore it if the replacement cannot be claimed.
    let vacate_result = pis_capacity::vacate_pis_timeslot(old_time).await;
    match vacate_result {
        Ok(_) => {}
        Err(err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": format!("Failed to vacate old timeslot: {}", err)
            })))
        }
    }

    let take_result = pis_capacity::take_pis_timeslot(new_time).await;
    match take_result {
        Ok(_) => {}
        Err(err) => {
            let _ = pis_capacity::take_pis_timeslot(old_time).await;
            return Ok(Json(json!({
                "status": "error",
                "message": format!("Failed to take new timeslot: {}", err)
            })));
        }
    }

    // Keep the rushee and signup time fields aligned for both read paths.
    let query = doc! {"gtid": id.clone()};
    let update = doc! {
        "$set": {
            "pis_timeslot": new_time,
            "pis_signup.time": new_time
        }
    };

    let update_result = connection.update_one(query, update).await;

    match update_result {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "Successfully rescheduled PIS"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to update rushee record"
        }))),
    }
}
