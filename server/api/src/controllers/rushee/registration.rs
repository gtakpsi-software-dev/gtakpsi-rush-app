use super::registration_record::build_registration_record;
use crate::controllers::db;
use crate::middlewares::valid;
use crate::models::rushee::{IncomingRushee, RusheeModel};
use crate::services::pis_capacity;
use crate::services::rush_time;
use axum::{http::StatusCode, response::Json};
use mongodb::Collection;
use rand::{distributions::Alphanumeric, Rng};
use serde_json::{json, Value};

pub async fn signup(Json(payload): Json<IncomingRushee>) -> Result<Json<Value>, StatusCode> {
    let collection: Collection<RusheeModel> = db::get_rushee_client().await;
    let pis_timeslot = rush_time::string_to_bson_datetime(&payload.pis_timeslot.to_string());
    let verify_attempt = valid::is_gtid_valid(&payload.gtid).await;

    match verify_attempt {
        Ok(false) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "gtid either already exists or is not 9 digits"
            })));
        }
        Err(_) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "failed to verify gtid"
            })));
        }
        Ok(true) => {}
    }

    // INVARIANT: Reserve the PIS slot before insertion to preserve the existing capacity and failure behavior.
    let take_timeslot_result = pis_capacity::take_pis_timeslot(pis_timeslot).await;
    if let Err(err) = take_timeslot_result {
        return Ok(Json(json!({
            "status": "error",
            "message": err.to_string()
        })));
    }

    let access_code: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(15)
        .map(char::from)
        .collect();

    let new_rushee = build_registration_record(&payload, pis_timeslot, &access_code);

    let result = collection.insert_one(new_rushee).await;
    match result {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "payload": access_code,
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "there was some error"
        }))),
    }
}
