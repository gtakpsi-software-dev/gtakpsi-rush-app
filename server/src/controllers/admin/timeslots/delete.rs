use axum::{http::StatusCode, response::Json};
use mongodb::bson::doc;
use serde_json::Value;

use super::{incoming_time_filter, timeslot_message};
use crate::controllers::db;
use crate::middlewares::time_helpers;
use crate::models::pis::PISTimeslotIncoming;

#[derive(Debug, PartialEq, Eq)]
pub(super) enum DeletionPlan {
    Delete,
    Update(i32),
}

pub(super) fn plan_deletion(num_available: i32, change: i32) -> DeletionPlan {
    // INVARIANT: the current API compares strictly, then adds the signed change.
    // Altering this arithmetic changes stored capacity for legacy callers.
    if num_available < change {
        DeletionPlan::Delete
    } else {
        DeletionPlan::Update(num_available + change)
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

#[cfg(test)]
mod tests {
    use super::{plan_deletion, DeletionPlan};

    #[test]
    fn deletion_plan_retains_strict_comparison_and_signed_addition() {
        assert_eq!(plan_deletion(2, 3), DeletionPlan::Delete);
        assert_eq!(plan_deletion(2, 2), DeletionPlan::Update(4));
        assert_eq!(plan_deletion(2, 1), DeletionPlan::Update(3));
        assert_eq!(plan_deletion(2, -1), DeletionPlan::Update(1));
    }
}
