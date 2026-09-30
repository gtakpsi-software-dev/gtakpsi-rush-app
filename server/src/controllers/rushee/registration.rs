use crate::controllers::db;
use crate::middlewares::{pis, time_helpers, valid};
use crate::models::{
    misc::RushNight,
    pis::PISSignup,
    rushee::{Comment, IncomingRushee, PisResponse, Rating, RusheeModel},
};
use axum::{http::StatusCode, response::Json};
use mongodb::bson::doc;
use mongodb::Collection;
use rand::{distributions::Alphanumeric, Rng};
use serde_json::{json, Value};

/**
 * Registers a new rushee
 */
pub async fn signup(Json(payload): Json<IncomingRushee>) -> Result<Json<Value>, StatusCode> {
    let collection: Collection<RusheeModel> = db::get_rushee_client().await;

    // convert incoming timeslot to a bson DateTime type
    let date_converstion = time_helpers::string_to_bson_datetime(&payload.pis_timeslot.to_string());

    // TODO: verify all fields

    // verify valid email

    // verify valid phone number (10 digits)

    // verify email and that email does not already exist

    // verify gtid does not already exists
    let verify_attempt = valid::is_gtid_valid(&payload.gtid).await;

    match verify_attempt {
        Ok(verify_result) => {
            if !verify_result {
                return Ok(Json(json!({
                    "status": "error",
                    "message": "gtid either already exists or is not 9 digits"
                })));
            }
        }

        Err(err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "failed to verify gtid"
            })))
        }
    }

    // take PIS timeslot
    let take_timeslot_result = pis::take_pis_timeslot(date_converstion).await;

    match take_timeslot_result {
        Ok(_x) => {
            // do nothing
        }

        Err(err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": err.to_string()
            })))
        }
    }

    let access_code: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(15)
        .map(char::from)
        .collect();

    let new_rushee = RusheeModel {
        first_name: payload.first_name.to_string(),
        last_name: payload.last_name.to_string(),
        housing: payload.housing.to_string(),
        phone_number: payload.phone_number.to_string(),
        email: payload.email.to_string(),
        gtid: payload.gtid.to_string(),
        major: payload.major.to_string(),
        class: payload.class.to_string(),
        pronouns: payload.pronouns.to_string(),
        image_url: payload.image_url.to_string(),
        exposure: payload.exposure.to_string(),
        pis_meeting_id: payload.pis_meeting_id.to_string(),
        pis_timeslot: date_converstion,
        pis_link: payload.pis_link.to_string(),
        cloud: "none".to_string(),
        pis: Vec::<PisResponse>::new(),
        comments: Vec::<Comment>::new(),
        attendance: Vec::<RushNight>::new(),
        ratings: Vec::<Rating>::new(),
        access_code: access_code.clone(),
        pis_signup: PISSignup {
            time: date_converstion,
            rushee_first_name: payload.first_name.to_string(),
            rushee_last_name: payload.last_name.to_string(),
            rushee_gtid: payload.gtid.to_string(),
            first_brother_first_name: "none".to_string(),
            first_brother_last_name: "none".to_string(),
            second_brother_first_name: "none".to_string(),
            second_brother_last_name: "none".to_string(),
            flex_window: payload.flex_window,
        },
        flex_window: payload.flex_window,
        assigned_pis_questions: None,
        sorting_status: "UNSORTED".to_string(),
        sorting_notes: String::new(),
        sorting_tags: Vec::new(),
        sorting_order: 0,
        notes_updated_at: None,
        notes_updated_by: None,
        status_updated_at: None,
        status_updated_by: None,
        rush_number: None,
        interactions_by_night: Vec::new(),
    };

    let result = collection.insert_one(new_rushee).await;

    match result {
        Ok(_insert_result) => {
            return Ok(Json(json!({
                "status": "success",
                "payload": access_code,
            })))
        }

        Err(_err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "there was some error"
            })))
        }
    }
}
