use axum::{http::StatusCode, response::Json};
use mongodb::bson::doc;
use serde_json::Value;

use super::{incoming_time_filter, timeslot_message};
use crate::models::pis::PISTimeslotIncoming;
use crate::services::pis_timeslot_deletion::{plan_deletion, DeletionPlan};
use crate::services::rush_time;
use crate::storage::db;

pub async fn delete_pis_timeslot(
    Json(payload): Json<PISTimeslotIncoming>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_timeslots_client().await;
    let time = rush_time::string_to_bson_datetime(&payload.time);

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

    match plan_deletion(existing.num_available, payload.change) {
        DeletionPlan::Delete => match connection.delete_one(doc! {"time": time}).await {
            Ok(_) => Ok(timeslot_message("success", "successfully deleted timeslot")),
            Err(_) => Ok(timeslot_message("error", "couldn't delete timeslot")),
        },
        DeletionPlan::Update(num_available) => {
            let update = doc! {"$set": {"num_available": num_available}};
            match connection.update_one(doc! {"time": time}, update).await {
                Ok(_) => Ok(timeslot_message(
                    "success",
                    "subtracted from num_available timeslots",
                )),
                Err(_) => Ok(timeslot_message("error", "some error occurred")),
            }
        }
    }
}
