mod comments;
pub use comments::{post_comment, delete_comment, edit_comment, get_brother_comments};

mod interview;
pub use interview::{get_pis_interview_questions, post_pis, autosave_pis, reschedule_pis, get_signup_timeslots, get_available_timeslots};

use axum::{
    extract::{Path, Query},
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

use super::db;
use crate::middlewares::{attendance, pis, time_helpers, valid};
use crate::models::misc::RushNight;
use crate::models::pis::PISSignup;
use crate::middlewares::rush_nights::{enrich_interactions_by_night, interactions_by_night};
use crate::models::rushee::{
    Comment, IncomingRushee, PisResponse, Rating, RusheeEdit, RusheeModel,
    RusheeSelfView, StrippedRushee,
};

#[derive(Deserialize, Serialize)]
struct Params {
    first: Option<String>,
    second: Option<String>,
}

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

#[derive(Debug, Deserialize)]
pub struct SelfViewParams {
    code: Option<String>,
}

/// Public self-service view for a rushee's own record (used by the
/// `/rushee/:gtid/:link` page). Requires the rushee's access code as a
/// `?code=` query param, validated server-side, and returns only a safe
/// subset of fields — never comments, sorting notes/status, ratings, or the
/// access code itself, since those are internal to bid committee/brothers.
pub async fn get_rushee_self(
    Path(id): Path<String>,
    Query(params): Query<SelfViewParams>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    let result = connection.find_one(doc! {"gtid": id.clone()}).await;

    match result {
        Ok(Some(rushee)) => {
            let provided_code = params.code.unwrap_or_default();
            if provided_code.is_empty() || provided_code != rushee.access_code {
                return Ok(Json(json!({
                    "status": "error",
                    "message": "Invalid access code"
                })));
            }

            let view: RusheeSelfView = rushee.into();
            Ok(Json(json!({
                "status": "success",
                "payload": view
            })))
        }

        Ok(None) => Ok(Json(json!({
            "status": "error",
            "message": format!("Rushee with GTID {} does not exist", id)
        }))),

        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "some network error occurred when fetching the rushee"
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
            let active_night =
                crate::middlewares::rush_nights::current_rush_night(&rush_nights, bson::DateTime::now());
            let active_night_name = match active_night {
                Some(n) => n.name,
                None => {
                    return Ok(Json(json!({
                        "status": "error",
                        "message": "no rush nights are configured"
                    })))
                }
            };
            for candidate_night in rush_nights.iter() {
                if candidate_night.name == active_night_name {
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

#[cfg(test)]
mod tests;
