use axum::{
    extract::Path,
    http::StatusCode,
    response::Json,
};
use bson::Document;
use futures::stream::StreamExt;
use mongodb::{
    bson::{doc, to_bson},
    Collection,
};
use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;

use super::db;
use crate::middlewares::timeHelpers::same_day;
use crate::middlewares::valid::check_valid_comment;
use crate::middlewares::{attendance, pis, timeHelpers, valid};
use crate::models::misc::RushNight;
use crate::models::pis::PISSignup;
use crate::middlewares::rush_nights::{enrich_interactions_by_night, interactions_by_night};
use crate::models::Rushee::{
    Comment, IncomingComment, IncomingRushee, PisResponse, Rating, RusheeEdit, RusheeModel,
    StrippedRushee,
};

#[derive(Deserialize, Serialize)]
struct Params {
    first: Option<String>,
    second: Option<String>,
}

/// 1–5 scale ratings used for averaging; legacy 0/5 values are excluded.
fn is_modern_rating_value(value: f32) -> bool {
    value >= 1.0 && value <= 5.0
}

/**
 * Registers a new rushee
 */
pub async fn signup(Json(payload): Json<IncomingRushee>) -> Result<Json<Value>, StatusCode> {
    let collection: Collection<RusheeModel> = db::get_rushee_client().await;

    // convert incoming timeslot to a bson DateTime type
    let date_converstion = timeHelpers::string_to_bson_datetime(&payload.pis_timeslot.to_string());

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

/**
 * gets all rushees in the following form: {"id", "name", "picture", "ratings" ...} (only the info needed for the homepage)
 * filters are passed in through the header
 */
pub async fn get_rush_nights() -> Result<Json<Value>, StatusCode> {
    match attendance::get_rush_nights_sorted().await {
        Ok(nights) => Ok(Json(json!({
            "status": "success",
            "payload": nights
        }))),
        Err(_err) => Ok(Json(json!({
            "status": "error",
            "message": "could not load rush nights"
        }))),
    }
}

pub async fn get_rushees() -> Result<Json<Value>, StatusCode> {
    let collection: Collection<RusheeModel> = db::get_rushee_client().await;
    let rush_nights = attendance::get_rush_nights_sorted()
        .await
        .unwrap_or_default();

    let result = collection
        .find({
            doc! {}
        })
        .await;

    match result {
        Ok(mut cursor) => {
            // TODO: extract useful info only
            let mut rushees = Vec::<StrippedRushee>::new();
            let mut order: i32 = 1;  // Start at 1 for registration order

            while let Some(rushee) = cursor.next().await {
                match rushee {
                    Ok(doc) => {
                        let night_interactions = interactions_by_night(
                            &rush_nights,
                            &doc.attendance,
                            &doc.comments,
                        );
                        rushees.push(StrippedRushee {
                        name: format!("{} {}", doc.first_name, doc.last_name),
                            first_name: doc.first_name.clone(),
                            last_name: doc.last_name.clone(),
                        class: doc.class,
                        gtid: doc.gtid,
                        major: doc.major,
                        ratings: doc.ratings,
                        image_url: doc.image_url,
                        email: doc.email,
                        pronouns: doc.pronouns,
                        attendance: doc.attendance,
                            registration_order: order,
                            pis_timeslot: Some(doc.pis_timeslot),
                            interactions_by_night: night_interactions,
                        });
                        order += 1;
                    },
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

// returns comments, ratings, etc..
pub async fn get_rushee(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    let result = connection.find_one(doc! {"gtid": id.clone()}).await;

    match result {
        Ok(insert_result) => match insert_result {
            Some(mut rushee) => {
                if let Ok(rush_nights) = attendance::get_rush_nights_sorted().await {
                    enrich_interactions_by_night(&mut rushee, &rush_nights);
                }
                Ok(Json(json!({
                    "status": "success",
                    "payload": rushee
                })))
            }

            None => Ok(Json(json!({
                "status": "error",
                "message": format!("Rushee with GTID {} does not exist", id)
            }))),
        },

        Err(err) => Ok(Json(json!({
            "status": "error",
            "message": "some network error occurred when fetching the rushee"
        }))),
    }
}

/**
 * Post a new comment to some rushee
 * Uses timestamp to record date
 */
pub async fn post_comment(
    Path(id): Path<String>,
    Json(payload): Json<IncomingComment>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;
    let fetch_rush_nights = attendance::get_rush_nights().await;

    match fetch_rush_nights {
        Ok(rush_nights) => {
            for rush_night in rush_nights.iter() {
                if same_day(&rush_night.time, &bson::DateTime::now()) {
                    // found rush night
                    let attempt_bson_night = to_bson(&rush_night);
                    let mut bson_night;

                    match attempt_bson_night {
                        Ok(x) => {
                            bson_night = x;
                        }

                        Err(_err) => {
                            return Ok(Json(json!({
                                "status": "error",
                                "message": "some issue occurred when serializing the rush night"
                            })))
                        }
                    }

                    let my_rush_night = RushNight {
                        name: rush_night.name.clone(),
                        time: rush_night.time,
                    };

                    let new_comment = Comment {
                        brother_id: payload.brother_id.clone(),
                        brother_name: payload.brother_name.clone(),
                        comment: payload.comment.clone(),
                        ratings: payload.ratings.clone(),
                        night: my_rush_night.clone(),
                    };

                    // fetch the rushee
                    let get_rushee_result = connection.find_one(doc! {"gtid": id.clone()}).await;

                    match get_rushee_result {
                        Ok(rushee_option) => {
                            let mut rushee;

                            match rushee_option {
                                Some(x) => {
                                    rushee = x;
                                }
                                None => {
                                    return Ok(Json(json!({
                                        "status": "error",
                                        "message": "some error occurred"
                                    })))
                                }
                            }

                            // check if brother has already made a comment
                            let is_valid = check_valid_comment(
                                &payload.brother_name,
                                &my_rush_night,
                                &rushee.comments,
                            )
                            .await;

                            match is_valid {
                                Ok(_result) => {
                                    // do nothing
                                }

                                Err(_err) => {
                                    return Ok(Json(json!({
                                        "status": "error",
                                        "message": "you have already made a comment for this rush night"
                                    })))
                                }
                            }

                            // update ratings
                            for rating in payload.ratings.iter() {
                                // Collect all ratings for this category from all comments
                                let mut values = Vec::new();

                                // Existing comments
                                for comment in &rushee.comments {
                                    if let Some(existing_rating) = comment.ratings.iter().find(|r| r.name == rating.name) {
                                        if is_modern_rating_value(existing_rating.value) {
                                            values.push(existing_rating.value);
                                        }
                                    }
                                }

                                // Add the new rating (from the current payload)
                                if is_modern_rating_value(rating.value) {
                                    values.push(rating.value);
                                }

                                // Calculate the average (out of 5)
                                let new_value = if !values.is_empty() {
                                    values.iter().sum::<f32>() / values.len() as f32
                                } else {
                                    0.0
                                };

                                let search_rating = rushee
                                    .ratings
                                    .iter()
                                    .find(|r: &&Rating| rating.name == r.name);

                                match search_rating {
                                    Some(_y) => {
                                        // Update existing rating
                                        let filter = doc! {
                                            "gtid": id.clone(),
                                            "ratings.name": rating.name.clone(),
                                        };
                                        let update = doc! {
                                            "$set": {
                                                "ratings.$.value": new_value,
                                            },
                                        };
                                        let update_result_try = connection.update_one(filter, update).await;

                                        match update_result_try {
                                            Ok(_update_result) => {
                                                // do nothing
                                            }
                                            Err(_err) => {
                                                return Ok(Json(json!({
                                                    "status": "error",
                                                    "message": "there was an error updating the rushee's global ratings"
                                                })))
                                            }
                                        }
                                    }
                                    None => {
                                        // **This is the important part for an empty array or new category**
                                        let filter = doc! {"gtid": id.clone()};
                                        let update = doc! {"$push": {"ratings": {"name": rating.name.clone(), "value": new_value}}};
                                        let update_result_try = connection.update_one(filter, update).await;

                                        match update_result_try {
                                            Ok(_update_result) => {
                                                // do nothing
                                            }
                                            Err(_err) => {
                                                return Ok(Json(json!({
                                                    "status": "error",
                                                    "message": "there was an error updating the rushee's global ratings"
                                                })))
                                            }
                                        }
                                    }
                                }
                            }

                            let mut bson_comment;
                            let mut bson_comment_try = to_bson(&new_comment);

                            match bson_comment_try {
                                Ok(x) => {
                                    bson_comment = x;
                                }
                                Err(err) => {
                                    return Ok(Json(json!({
                                        "status": "error",
                                        "message": "some error occurred"
                                    })))
                                }
                            }

                            let filter = doc! {"gtid": id};
                            let update = doc! {"$push": {
                                "comments": bson_comment,
                            }};

                            let result = connection.update_one(filter, update).await;

                            match result {
                                Ok(_update_result) => {
                                    return Ok(Json(json!({
                                        "status": "success",
                                        "message": "successfully updated rushee"
                                    })))
                                }

                                Err(_err) => {
                                    return Ok(Json(json!({
                                        "status": "error",
                                        "message": "something wrong occurred"
                                    })))
                                }
                            }
                        }

                        Err(_err) => {
                            return Ok(Json(json!({
                                "status": "error",
                                "message": "something wrong occurred"
                            })))
                        }
                    }
                }
            }

            return Ok(Json(json!({
                "status": "error",
                "message": "couldn't match a rush night"
            })));
        }

        Err(_err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "there was some error while matching the rush night"
            })))
        }
    }
}

/**
 * Post a Rushee's PIS
 */
pub async fn post_pis(
    Path(id): Path<String>,
    Json(payload): Json<Vec<PisResponse>>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    let mut filter;
    let mut update;

    // null out current entries
    filter = doc! {"gtid": id.clone()};
    update = doc! {"$set": doc! { "pis" : [] }};

    let clear_out_result = connection.update_one(filter, update).await;

    match clear_out_result {

        Ok(_clear_out) => {

        }

        Err(_err) => {
            return Ok(Json(json!({
                "status": "success",
                "message": "There was an error clearing out the current PIS responses"
            })))
        }

    }

    let mut pis_bson_try;
    let mut pis_bson;

    for response in payload.iter() {
        // push the pis response
        filter = doc! {"gtid": id.clone()};

        pis_bson_try = to_bson(&response);

        match pis_bson_try {
            Ok(x) => {
                pis_bson = x;
            }
            Err(err) => {
                return Ok(Json(json!({
                    "status": "error",
                    "message": "couldn't make the pis response into a bson file"
                })))
            }
        }

        update = doc! {
            "$push" : {
                "pis": pis_bson,
            }
        };

        let result = connection.update_one(filter, update).await;

        match result {
            Ok(update_result) => {
                // do nothing
            }

            Err(err) => {
                return Ok(Json(json!({
                    "status": "error",
                    "message": "failed to push a pis response"
                })))
            }
        }
    }

    Ok(Json(json!({
        "status": "success",
        "message": "succesfully stored rushee's pis"
    })))
}

/**
 * Autosave PIS - saves brothers and answers in one call
 */
#[derive(Deserialize, Serialize)]
pub struct PISAutosavePayload {
    pub pis_responses: Vec<PisResponse>,
    pub brother_a_first_name: String,
    pub brother_a_last_name: String,
    pub brother_b_first_name: String,
    pub brother_b_last_name: String,
}

pub async fn autosave_pis(
    Path(id): Path<String>,
    Json(payload): Json<PISAutosavePayload>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    // Convert PIS responses to BSON array
    let pis_bson_result = to_bson(&payload.pis_responses);
    let pis_bson = match pis_bson_result {
        Ok(b) => b,
        Err(_) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "Failed to convert PIS responses to BSON"
            })))
        }
    };

    // Update everything in one call
    let filter = doc! {"gtid": id.clone()};
    let update = doc! {
        "$set": {
            "pis": pis_bson,
            "pis_signup.first_brother_first_name": if payload.brother_a_first_name.trim().is_empty() { "none".to_string() } else { payload.brother_a_first_name.trim().to_string() },
            "pis_signup.first_brother_last_name": if payload.brother_a_last_name.trim().is_empty() { "none".to_string() } else { payload.brother_a_last_name.trim().to_string() },
            "pis_signup.second_brother_first_name": if payload.brother_b_first_name.trim().is_empty() { "none".to_string() } else { payload.brother_b_first_name.trim().to_string() },
            "pis_signup.second_brother_last_name": if payload.brother_b_last_name.trim().is_empty() { "none".to_string() } else { payload.brother_b_last_name.trim().to_string() },
        }
    };

    let result = connection.update_one(filter, update).await;

    match result {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "PIS autosaved successfully"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to autosave PIS"
        }))),
    }
}

/**
 * Uses current time to stamp attendance
 */
pub async fn update_attendance(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let fetch_rush_nights = attendance::get_rush_nights().await;
    let connection = db::get_rushee_client().await;

    match fetch_rush_nights {
        Ok(rush_nights) => {
            for candidate_night in rush_nights.iter() {
                if same_day(&candidate_night.time, &bson::DateTime::now()) {
                    // found rush night

                    let attempt_bson_night = to_bson(&candidate_night);
                    let mut bson_night;

                    match attempt_bson_night {
                        Ok(x) => {
                            bson_night = x;
                        }

                        Err(_err) => {
                            return Ok(Json(json!({
                                "status": "error",
                                "message": "some issue occurred when serializing the rush night"
                            })))
                        }
                    }

                    let filter = doc! {"gtid": id.clone()};
                    let update = doc! {"$addToSet": {
                        "attendance": bson_night,
                    }};

                    let result = connection.update_one(filter, update).await;

                    match result {
                        Ok(_update_result) => {
                            return Ok(Json(json!({
                                "status": "success",
                                "message": "updated rushee attendance"
                            })))
                        }

                        Err(_err) => {
                            return Ok(Json(json!({
                                "status": "error",
                                "message": "couldn't update rushee attendance"
                            })))
                        }
                    }
                }
            }

            return Ok(Json(json!({
                "status": "error",
                "message": "rush night does not exist"
            })));
        }

        Err(err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "some error occurred"
            })))
        }
    }
}

/**
 * Update the cloud the rushee is in
 */
pub async fn update_cloud(
    Path(id): Path<String>,
    Json(payload): Json<String>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    let filter = doc! {"_id": id};
    let update = doc! {"$set": doc! {"cloud": payload}};

    let result = connection.update_one(filter, update).await;

    match result {
        Ok(update_result) => Ok(Json(json!({
            "status": "success",
            "message": "sucessfully updated rushee cloud"
        }))),

        Err(err) => Ok(Json(json!({
            "status": "error",
            "message": "did not update cloud"
        }))),
    }
}

/**
 * Update rushee (edit rushee's attributes)
 */
pub async fn update_rushee(
    Path(id): Path<String>,
    Json(payload): Json<Vec<RusheeEdit>>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    let mut filter: Document;
    let mut update: Document;

    for edit in payload.iter() {
        if valid::get_pis_signup_breaking_changes().contains(&edit.field) {
            filter = doc! {"gtid": id.clone()};
            update = doc! {
                "$set": {
                    edit.field.clone(): edit.new_value.clone(),
                    format!("pis_signup.rushee_{}", edit.field.clone()): edit.new_value.clone()
                }
            };

            let result = connection.update_one(filter, update).await;

            match result {
                Ok(_update_reult) => {
                    // do nothing
                }

                Err(err) => {
                    return Ok(Json(json!({
                        "status": "error",
                        "message": err.to_string()
                    })))
                }
            }

        } else if valid::get_rushee_edit_fields().contains(&edit.field) {
            filter = doc! {"gtid": id.clone()};
            update = doc! {"$set": doc! { edit.field.clone(): edit.new_value.clone() }};

            let result = connection.update_one(filter, update).await;

            match result {
                Ok(_update_reult) => {
                    // do nothing
                }

                Err(_err) => {
                    return Ok(Json(json!({
                        "status": "error",
                        "message": "Some error occurred when updating the rushee"
                    })))
                }
            }
        } else {
            return Ok(Json(json!({
                "status": "error",
                "message": format!("Invalid rushee field passed in: {}", edit.field)
            })));
        }
    }

    Ok(Json(json!({
        "status": "success",
        "message": "Successfully updated all fields"
    })))
}

/**
 * Reschedule Rushee PIS
 * Accepts GTID as path param and new timeslot as body (ISO string)
 * Vacates old slot, takes new slot, updates rushee
 */
pub async fn reschedule_pis(
    Path(id): Path<String>,
    Json(payload): Json<String>,
) -> Result<Json<Value>, StatusCode> {
    let new_time = timeHelpers::string_to_bson_datetime(&payload);
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
            })))
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

pub async fn delete_comment(
    Path(id): Path<String>,
    Json(payload): Json<Comment>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    // First fetch the rushee data before deletion
    let fetch_filter = doc! {"gtid": id.clone()};
    let get_rushee_result = connection.find_one(fetch_filter).await;

    let mut rushee;
    match get_rushee_result {
        Ok(rushee_option) => {
            match rushee_option {
                Some(x) => {
                    rushee = x;
                }
                None => {
                    return Ok(Json(json!({
                        "status": "error",
                        "message": "rushee not found"
                    })))
                }
            }
        }
        Err(_err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "error fetching rushee data"
            })))
        }
    }

    let mut bson_night: bson::Bson;
    let bson_night_attempt = to_bson(&payload.night);

    match bson_night_attempt {
        Ok(x) => {
            bson_night = x;
        }
        Err(_error) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "there was an error bsonifying the night"
            })))
        }
    }

    // Remove the comment
    let filter = doc! {"gtid": id.clone()};
    let update = doc! {
        "$pull": {
            "comments": {
                "brother_name": &payload.brother_name,
                "night": bson_night
            }
        }
    };
    let update_result = connection.update_one(filter, update).await;

    match update_result {
        Ok(_result) => {
            // Now recalculate ratings based on remaining comments
            // Filter out the deleted comment from our local copy
            let remaining_comments: Vec<Comment> = rushee.comments.into_iter()
                .filter(|comment| {
                    !(comment.brother_name == payload.brother_name && 
                      same_day(&comment.night.time, &payload.night.time))
                })
                .collect();

            // Get all unique rating categories from deleted comment
            let mut rating_categories = HashSet::new();
            for rating in &payload.ratings {
                rating_categories.insert(rating.name.clone());
            }

            // Recalculate each rating category
            for category in rating_categories {
                let mut values = Vec::new();

                // Collect all remaining ratings for this category
                for comment in &remaining_comments {
                    if let Some(existing_rating) = comment.ratings.iter().find(|r| r.name == category) {
                        if is_modern_rating_value(existing_rating.value) {
                            values.push(existing_rating.value);
                        }
                    }
                }

                if !values.is_empty() {
                    // Calculate new average and update the rating
                    let new_value = values.iter().sum::<f32>() / values.len() as f32;
                    
                    let rating_filter = doc! {"gtid": id.clone(), "ratings.name": &category};
                    let rating_update = doc! {
                        "$set": {
                            "ratings.$.value": new_value
                        }
                    };
                    
                    let rating_update_result = connection.update_one(rating_filter, rating_update).await;
                    
                    match rating_update_result {
                        Ok(_) => {
                            // Success - continue to next category
                        }
                        Err(_err) => {
                            return Ok(Json(json!({
                                "status": "error",
                                "message": "error updating ratings after comment deletion"
                            })))
                        }
                    }
                } else {
                    // No remaining ratings for this category - remove it entirely
                    let rating_filter = doc! {"gtid": id.clone()};
                    let rating_update = doc! {
                        "$pull": {
                            "ratings": {
                                "name": &category
                            }
                        }
                    };
                    
                    let rating_update_result = connection.update_one(rating_filter, rating_update).await;
                    
                    match rating_update_result {
                        Ok(_) => {
                            // Success - rating category removed
                        }
                        Err(_err) => {
                            return Ok(Json(json!({
                                "status": "error",
                                "message": "error removing rating category after comment deletion"
                            })))
                        }
                    }
                }
            }

            return Ok(Json(json!({
                "status": "success",
                "message": "successfully deleted comment and updated ratings"
            })))
        }

        Err(_err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "couldn't delete the comment from the database"
            })))
        }
    }
}

pub async fn edit_comment(
    Path(id): Path<String>,
    Json(payload): Json<Comment>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    let mut bson_night: bson::Bson;
    let bson_night_attempt = to_bson(&payload.night);

    match bson_night_attempt {
        Ok(x) => {
            bson_night = x;
        }

        Err(_error) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "there was an error bsonifying the night"
            })))
        }
    }

    let filter = doc! {
        "gtid": id.clone(),
        "comments": {
            "$elemMatch": {
                "brother_name": payload.brother_name,
                "night": bson_night,
            }
        }
    };

    let update = doc! {
        "$set": {
            "comments.$.comment": payload.comment
        }
    };

    let edit_result = connection.update_one(filter, update).await;

    match edit_result {
        Ok(_edit) => {
            return Ok(Json(json!({
                "status": "success",
                "message": "updated comment successfully"
            })))
        }

        Err(_err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "there was an error pushing the update to the database"
            })))
        }
    }
}

pub async fn does_rushee_exist(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    let result = connection.find_one(doc! {"gtid": id.clone()}).await;

    match result {
        Ok(insert_result) => match insert_result {
            Some(rushee) => Ok(Json(
                (json!({
                    "status": "error",
                    "message": format!("exists")
                })),
            )),

            None => Ok(Json(json!({
                "status": "success",
                "message": format!("Rushee with GTID {} does not exist", id)
            }))),
        },

        Err(err) => Ok(Json(json!({
            "status": "error",
            "message": "Some network error occurred when checking if the rushee exists or not"
        }))),
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
                let time_a = a["time"]["$date"]["$numberLong"].as_str().unwrap_or("0").parse::<i64>().unwrap_or(0);
                let time_b = b["time"]["$date"]["$numberLong"].as_str().unwrap_or("0").parse::<i64>().unwrap_or(0);
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

/// Returns all rushees where the given brother_name has commented, with rushee info and the brother's comment(s)
pub async fn get_brother_comments(Path(brother_name): Path<String>) -> Result<Json<Value>, StatusCode> {
    let collection = db::get_rushee_client().await;
    let result = collection.find(doc! {}).await;

    match result {
        Ok(mut cursor) => {
            let mut commented_rushees = Vec::new();
            while let Some(rushee_res) = cursor.next().await {
                if let Ok(rushee) = rushee_res {
                    // Find all comments by this brother on this rushee
                    let brother_comments: Vec<_> = rushee.comments.iter()
                        .filter(|c| c.brother_name == brother_name)
                        .cloned()
                        .collect();
                    if !brother_comments.is_empty() {
                        commented_rushees.push(serde_json::json!({
                            "rushee": {
                                "gtid": rushee.gtid,
                                "first_name": rushee.first_name,
                                "last_name": rushee.last_name,
                                "image_url": rushee.image_url,
                            },
                            "comments": brother_comments
                        }));
                    }
                }
            }
            Ok(Json(json!({
                "status": "success",
                "payload": commented_rushees
            })))
        }
        Err(_err) => Ok(Json(json!({
            "status": "error",
            "message": "some network error occurred"
        }))),
    }
}
