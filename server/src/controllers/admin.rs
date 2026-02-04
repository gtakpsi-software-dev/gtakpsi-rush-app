use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use futures::stream::StreamExt;
use mongodb::bson::{doc, DateTime};
use serde_json::{json, Value};
use serde::{Deserialize, Serialize};
use axum::extract::Extension;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::{
    middlewares::timeHelpers::{self, string_to_bson_datetime},
    models::{
        misc::{IncomingBrotherName, IncomingRushNight, RushNight},
        pis::{IncomingPISSignup, PISQuestion, PISTimeslot, PISTimeslotIncoming, PISAvailabilityFormStatus, BrotherPISAvailability, IncomingBrotherAvailability, RushAppStatus, UpdateRushAppPayload, CheckAccessPayload},
        Rushee::StrippedRushee,
    },
    middlewares::auth::FirebaseAuth,
};

use super::db;

const SORTING_STATUSES: [&str; 6] = [
    "UNSORTED",
    "IN_CLOUD",
    "MID_CLOUD",
    "OUT_CLOUD",
    "DISCUSSED",
    "INELIGIBLE",
];

// Serialize sorting reorder updates to avoid interleaving writes.
static SORTING_REORDER_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));
static SORTING_COLUMN_LOCKS: Lazy<HashMap<String, Arc<Mutex<()>>>> = Lazy::new(|| {
    let mut map = HashMap::new();
    for status in SORTING_STATUSES.iter() {
        map.insert((*status).to_string(), Arc::new(Mutex::new(())));
    }
    map
});

/**
 * Add a PIS question
 */
pub async fn add_pis_question(Json(payload): Json<PISQuestion>) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_questions_client().await;

    let new_question = PISQuestion {
        question: payload.question,
        question_type: payload.question_type,
        order: payload.order,
    };

    let result = connection.insert_one(new_question).await;

    match result {
        Ok(_insert_result) => Ok(Json(json!({
            "status": "success",
            "message": "successfully added pis question"
        }))),
        Err(_err) => Ok(Json(json!({
            "status": "error",
            "message": "failed to add pis question"
        }))),
    }
}

/**
 * Delete a PIS question
 */
pub async fn delete_pis_question(
    Json(payload): Json<PISQuestion>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_questions_client().await;

    let filter = doc! {"$and": [
        doc! {"question": payload.question},
        doc! {"question_type": payload.question_type}
    ]};

    let result = connection.delete_one(filter).await;

    match result {
        Ok(_delete_result) => Ok(Json(json!({
            "status": "success",
            "message": "successfully deleted PIS question"
        }))),
        Err(_err) => Ok(Json(json!({
            "status": "error",
            "message": "some error occurred"
        }))),
    }
}

/**
 * Fetch all the PIS questions
 */
pub async fn get_pis_questions() -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_questions_client().await;
    let result = connection.find(doc! {}).await;

    match result {
        Ok(mut cursor) => {
            let mut pis_questions: Vec<PISQuestion> = Vec::new();

            while let Some(question) = cursor.next().await {
                match question {
                    Ok(doc) => pis_questions.push(doc),
                    Err(err) => {
                        return Ok(Json(json!({
                            "status": "error",
                            "message": "some error occurred"
                        })))
                    }
                }
            }

            Ok(Json(json!({
                "status": "success",
                "payload": pis_questions
            })))
        }

        Err(err) => Ok(Json(json!({
            "status": "error",
            "message": "some error occurred while fetching data"
        }))),
    }
}

/**
 * Add a certain number of PIS timeslots
 * Input must be formatted as a bson DateTime object
 */
pub async fn add_pis_timeslot(
    Json(payload): Json<PISTimeslotIncoming>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_timeslots_client().await;

    let time = timeHelpers::string_to_bson_datetime(&payload.time);

    // check if timeslot exists
    let filter = doc! {"time": time};
    let result = connection.find_one(filter).await;

    match result {
        Ok(find_result) => match find_result {
            Some(timeslot) => {
                let update_filter = doc! {"time": payload.time};
                let update = doc! {"$set": doc! {
                    "num_available": timeslot.num_available + payload.change
                }};

                let update_result = connection.update_one(update_filter, update).await;

                match update_result {
                    Ok(_x) => {
                        return Ok(Json(json!({
                            "status": "success",
                            "message": "added to num_available timeslots"
                        })))
                    }

                    Err(_err) => {
                        return Ok(Json(json!({
                            "status": "error",
                            "message": "some error occurred"
                        })))
                    }
                }
            }

            None => {
                let new_pis_timeslot = PISTimeslot {
                    time: time,
                    num_available: payload.change,
                };

                let add_result = connection.insert_one(new_pis_timeslot).await;

                match add_result {
                    Ok(_x) => {
                        return Ok(Json(json!({
                            "status": "success",
                            "message": "successfully created new pis timeslot"
                        })))
                    }
                    Err(_err) => {
                        return Ok(Json(json!({
                            "status": "error",
                            "message": "some error occurred while creating the PIS timeslot"
                        })))
                    }
                }
            }
        },

        Err(_err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "some error occurred"
            })))
        }
    }
}

/**
 * Delete a certain number of PIS timeslots
 * NOTE: If final number is negative, the timeslot is deleted
 */
pub async fn delete_pis_timeslot(
    Json(payload): Json<PISTimeslotIncoming>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_timeslots_client().await;

    let time = timeHelpers::string_to_bson_datetime(&payload.time);

    // check if timeslot exists
    let filter = doc! {"time": payload.time};
    let result = connection.find_one(filter).await;

    match result {
        Ok(find_result) => match find_result {
            Some(timeslot) => {
                if timeslot.num_available < payload.change {
                    // delete timeslot
                    let delete_filter = doc! {"time": time};

                    let delete_result = connection.delete_one(delete_filter).await;

                    match delete_result {
                        Ok(_x) => Ok(Json(json!({
                            "status": "success",
                            "message": "successfully deleted timeslot"
                        }))),

                        Err(_err) => Ok(Json(json!({
                            "status": "error",
                            "message": "couldn't delete timeslot"
                        }))),
                    }
                } else {
                    let update_filter = doc! {"time": time};
                    let update = doc! {"$set": doc! {
                        "num_available": timeslot.num_available + payload.change
                    }};

                    let update_result = connection.update_one(update_filter, update).await;

                    match update_result {
                        Ok(_x) => {
                            return Ok(Json(json!({
                                "status": "success",
                                "message": "subtracted from num_available timeslots"
                            })))
                        }

                        Err(_err) => {
                            return Ok(Json(json!({
                                "status": "error",
                                "message": "some error occurred"
                            })))
                        }
                    }
                }
            }

            None => {
                return Ok(Json(json!({
                    "status": "error",
                    "message": "pis timeslot doesn't exist"
                })))
            }
        },

        Err(_err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "some error occurred"
            })))
        }
    }
}

/**
 * Fetch all the PIS timeslots
 */
pub async fn get_pis_timeslots() -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_timeslots_client().await;

    let result = connection.find(doc! {}).await;

    match result {
        Ok(mut cursor) => {
            let mut pis_timeslots: Vec<PISTimeslot> = Vec::new();

            while let Some(timeslot) = cursor.next().await {
                match timeslot {
                    Ok(doc) => pis_timeslots.push(doc),
                    Err(err) => {
                        return Ok(Json(json!({
                            "status": "error",
                            "message": "some error occurred"
                        })))
                    }
                }
            }

            Ok(Json(json!({
                "status": "success",
                "payload": pis_timeslots
            })))
        }

        Err(err) => Ok(Json(json!({
            "status": "error",
            "message": "some error occurred while fetching data"
        }))),
    }
}

/**
 * Add Rush Night
 */
pub async fn add_rush_night(
    Json(payload): Json<IncomingRushNight>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rush_nights_client().await;

    let new_rush_night = RushNight {
        time: string_to_bson_datetime(&payload.time),
        name: payload.name,
    };

    let result = connection.insert_one(new_rush_night).await;

    match result {
        Ok(_insert_result) => Ok(Json(json!({
            "status": "success",
            "message": "successfully added rush night"
        }))),

        Err(_err) => Ok(Json(json!({
            "status": "error",
            "message": "couldn't add rush night"
        }))),
    }
}

/**
 * Delete a Rush Night
 * Fix this later -> make it only date, right now the time is set to 12:00 PM, or should be
 */
pub async fn delete_rush_night(Json(payload): Json<RushNight>) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rush_nights_client().await;

    let filter = doc! {"time": payload.time};
    let result = connection.delete_one(filter).await;

    match result {
        Ok(_delete_result) => Ok(Json(json!({
            "status": "success",
            "message": "successfully deleted rush night"
        }))),

        Err(_err) => Ok(Json(json!({
            "status": "error",
            "message": "there was an issue while deleting the rush night"
        }))),
    }
}

pub async fn brother_pis_sign_up(
    Path(id): Path<String>,
    Json(payload): Json<IncomingPISSignup>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;
    let fetch_rushee = connection.find_one(doc! {"gtid": id.clone()}).await;

    match fetch_rushee {
        Ok(rushee_option) => match rushee_option {
            Some(rushee) => {
                if (rushee.pis_signup.first_brother_first_name == "none"
                    && rushee.pis_signup.first_brother_last_name == "none")
                {
                    // update first and last name
                    let update = doc! {"$set": {"pis_signup.first_brother_first_name": payload.brother_first_name}};
                    let first_name_update = connection
                        .update_one(doc! {"gtid": id.clone()}, update)
                        .await;

                    match first_name_update {
                        Ok(_first_result) => {
                            let last_update = doc! {"$set": {"pis_signup.first_brother_last_name": payload.brother_last_name}};
                            let last_name_update = connection
                                .update_one(doc! {"gtid": id.clone()}, last_update)
                                .await;

                            match last_name_update {
                                Ok(_result) => {
                                    return Ok(Json(json!({
                                        "status": "success",
                                        "message": "Successfully registered!"
                                    })))
                                }

                                Err(_err) => {
                                    return Ok(Json(json!({
                                        "status": "error",
                                        "message": "Couldn't update the PIS Signup for last name"
                                    })))
                                }
                            }
                        }

                        Err(_err) => {
                            return Ok(Json(json!({
                                "status": "error",
                                "message": "Couldn't update the PIS Signup for first name"
                            })))
                        }
                    }
                } else if (rushee.pis_signup.second_brother_first_name == "none"
                    && rushee.pis_signup.second_brother_last_name == "none")
                {
                    // check if duplicate brother
                    if (rushee.pis_signup.first_brother_first_name == payload.brother_first_name
                        && rushee.pis_signup.first_brother_last_name == payload.brother_last_name)
                    {
                        return Ok(Json(json!({
                            "status": "error",
                            "message": format!("Brother {} {} has already registered for this PIS.", payload.brother_first_name, payload.brother_last_name)
                        })));
                    }

                    // update first and last name
                    let update = doc! {"$set": {"pis_signup.second_brother_first_name": payload.brother_first_name}};
                    let first_name_update = connection
                        .update_one(doc! {"gtid": id.clone()}, update)
                        .await;

                    match first_name_update {
                        Ok(_first_result) => {
                            let last_update = doc! {"$set": {"pis_signup.second_brother_last_name": payload.brother_last_name}};
                            let last_name_update = connection
                                .update_one(doc! {"gtid": id.clone()}, last_update)
                                .await;

                            match last_name_update {
                                Ok(_result) => {
                                    return Ok(Json(json!({
                                        "status": "success",
                                        "message": "Successfully registered for PIS!"
                                    })))
                                }

                                Err(_err) => {
                                    return Ok(Json(json!({
                                        "status": "error",
                                        "message": "Couldn't update the PIS Signup for last name"
                                    })))
                                }
                            }
                        }

                        Err(_err) => {
                            return Ok(Json(json!({
                                "status": "error",
                                "message": "Couldn't update the PIS Signup for first name"
                            })))
                        }
                    }
                } else {
                    return Ok(Json(json!({
                        "status": "error",
                        "message": format!("Two brothers ({} {} and {} {}) are already signed up",
                                            rushee.pis_signup.first_brother_first_name,
                                            rushee.pis_signup.first_brother_last_name,
                                            rushee.pis_signup.second_brother_first_name,
                                            rushee.pis_signup.second_brother_last_name)
                    })));
                }
            }
            None => {
                return Ok(Json(json!({
                    "status": "error",
                    "message": format!("The rushee with GTID {} does not exist", id.clone())
                })))
            }
        },

        Err(_err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "Couldn't access the MongoDB database"
            })))
        }
    }
}

pub async fn get_brother_pis(
    Json(payload): Json<IncomingBrotherName>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    // Use projection to only fetch fields needed - avoids transferring comments
    let options = mongodb::options::FindOptions::builder()
        .projection(doc! {
            "first_name": 1,
            "last_name": 1,
            "gtid": 1,
            "major": 1,
            "ratings": 1,
            "image_url": 1,
            "class": 1,
            "email": 1,
            "pronouns": 1,
            "attendance": 1,
            "pis_timeslot": 1,
            "pis_signup": 1
        })
        .build();

    let result = connection
        .find(doc! {})
        .with_options(options)
        .await;

    match result {
        Ok(mut cursor) => {
            // TODO: extract useful info only
            let mut rushees = Vec::<StrippedRushee>::new();

            while let Some(rushee) = cursor.next().await {
                match rushee {
                    Ok(doc) => {
                        if ((doc
                            .pis_signup
                            .first_brother_first_name
                            .eq(&payload.first_name)
                            && doc
                                .pis_signup
                                .first_brother_last_name
                                .eq(&payload.last_name))
                            || (doc.pis_signup.second_brother_first_name).eq(&payload.first_name)
                                && doc
                                    .pis_signup
                                    .second_brother_last_name
                                    .eq(&payload.last_name))
                        {

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
                                registration_order: 0,  // Not used in this context
                                pis_timeslot: Some(doc.pis_timeslot),
                            });

                        }
                    }
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

/**
 * Export rushee number mapping as CSV data
 * Returns array of objects with rushee_number and name for CSV export
 */
pub async fn export_rushee_numbers() -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    // Only fetch fields needed for export
    let options = mongodb::options::FindOptions::builder()
        .projection(doc! {
            "first_name": 1,
            "last_name": 1,
            "rush_number": 1
        })
        .build();

    let result = connection
        .find(doc! {})
        .with_options(options)
        .await;

    match result {
        Ok(mut cursor) => {
            let mut rushee_mappings = Vec::<serde_json::Value>::new();
            let mut order: i32 = 1;

            while let Some(rushee) = cursor.next().await {
                match rushee {
                    Ok(doc) => {
                        rushee_mappings.push(json!({
                            "rushee_number": format!("{:03}", order),
                            "name": format!("{} {}", doc.first_name, doc.last_name),
                            "gtid": doc.gtid,
                        }));
                        order += 1;
                    },
                    Err(err) => {
                        println!("{}", err.to_string());
                        return Ok(Json(json!({
                            "status": "error",
                            "message": "Error reading rushee data"
                        })));
                    }
                }
            }

            Ok(Json(json!({
                "status": "success",
                "payload": rushee_mappings
            })))
        }

        Err(_err) => Ok(Json(json!({
            "status": "error",
            "message": "Database error"
        }))),
    }
}

#[derive(Serialize)]
pub struct SortingRushee {
    pub id: String,
    pub fullName: String,
    pub rushNumber: i32,
    pub sortingStatus: String,
    pub sortingOrder: i32,
    pub sortingTags: Vec<String>,
}

#[derive(Deserialize)]
pub struct UpdateSortingPayload {
    pub sortingStatus: String,
    pub sortingOrder: i32,
}

#[derive(Deserialize)]
pub struct BulkReorderPayload {
    pub column: String,
    pub orderedRusheeIds: Vec<String>,
}

#[derive(Deserialize)]
pub struct MoveRusheePayload {
    pub fromColumn: String,
    pub toColumn: String,
    pub movedRusheeId: String,
    pub targetIndex: i32,
}

#[derive(Deserialize)]
pub struct NotesPayload {
    pub sortingNotes: String,
    #[serde(default)]
    pub sortingTags: Vec<String>,
}

fn validate_status(status: &str) -> bool {
    SORTING_STATUSES.iter().any(|s| s == &status)
}

/// Fetch all rushees for sorting board
pub async fn get_sorting_rushees() -> Result<Json<Value>, StatusCode> {
    let collection: mongodb::Collection<crate::models::Rushee::RusheeModel> = db::get_rushee_client().await;

    // Use projection to only fetch fields needed for sorting - avoids transferring comments/pis
    let options = mongodb::options::FindOptions::builder()
        .projection(doc! {
            "gtid": 1,
            "first_name": 1,
            "last_name": 1,
            "sorting_status": 1,
            "sorting_order": 1,
            "sorting_tags": 1,
            "rush_number": 1
        })
        .build();

    let cursor_result = collection.find(doc! {}).with_options(options).await;
    match cursor_result {
        Ok(mut cursor) => {
            let mut list: Vec<SortingRushee> = Vec::new();
            let mut order_counter: i32 = 1;
            while let Some(item) = cursor.next().await {
                if let Ok(doc) = item {
                    let status = if validate_status(&doc.sorting_status) {
                        doc.sorting_status.clone()
                    } else {
                        "UNSORTED".to_string()
                    };

                    let order = if doc.sorting_order > 0 {
                        doc.sorting_order
                    } else {
                        order_counter
                    };

                    let rush_number = doc.rush_number.unwrap_or(order_counter);

                    list.push(SortingRushee {
                        id: doc.gtid.clone(), // use gtid as id for consistency
                        fullName: format!("{} {}", doc.first_name, doc.last_name),
                        rushNumber: rush_number,
                        sortingStatus: status,
                        sortingOrder: order,
                        sortingTags: doc.sorting_tags.clone(),
                    });
                    order_counter += 1;
                }
            }

            // Stable ordering by status then order
            list.sort_by(|a, b| {
                let ai = SORTING_STATUSES.iter().position(|s| *s == a.sortingStatus).unwrap_or(0);
                let bi = SORTING_STATUSES.iter().position(|s| *s == b.sortingStatus).unwrap_or(0);
                ai.cmp(&bi)
                    .then(a.sortingOrder.cmp(&b.sortingOrder))
                    .then_with(|| a.id.cmp(&b.id))
            });

            Ok(Json(json!({
                "status": "success",
                "payload": list
            })))
        }
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to fetch rushees"
        }))),
    }
}

/// Public endpoint: Fetch rushees for sorting board (view-only, shows names)
/// Accessible to all authenticated brothers
pub async fn get_sorting_rushees_public() -> Result<Json<Value>, StatusCode> {
    let collection: mongodb::Collection<crate::models::Rushee::RusheeModel> = db::get_rushee_client().await;

    // Use projection to only fetch fields needed for sorting - avoids transferring comments/pis
    let options = mongodb::options::FindOptions::builder()
        .projection(doc! {
            "gtid": 1,
            "first_name": 1,
            "last_name": 1,
            "sorting_status": 1,
            "sorting_order": 1,
            "sorting_tags": 1
        })
        .build();

    let cursor_result = collection.find(doc! {}).with_options(options).await;
    match cursor_result {
        Ok(mut cursor) => {
            let mut list: Vec<SortingRushee> = Vec::new();
            let mut order_counter: i32 = 1;
            while let Some(item) = cursor.next().await {
                if let Ok(doc) = item {
                    let status = if validate_status(&doc.sorting_status) {
                        doc.sorting_status.clone()
                    } else {
                        "UNSORTED".to_string()
                    };

                    let order = if doc.sorting_order > 0 {
                        doc.sorting_order
                    } else {
                        order_counter
                    };

                    list.push(SortingRushee {
                        id: doc.gtid.clone(),
                        fullName: format!("{} {}", doc.first_name, doc.last_name),
                        rushNumber: 0, // Don't expose rushee numbers to regular brothers
                        sortingStatus: status,
                        sortingOrder: order,
                        sortingTags: doc.sorting_tags.clone(),
                    });
                    order_counter += 1;
                }
            }

            // Stable ordering by status then order
            list.sort_by(|a, b| {
                let ai = SORTING_STATUSES.iter().position(|s| *s == a.sortingStatus).unwrap_or(0);
                let bi = SORTING_STATUSES.iter().position(|s| *s == b.sortingStatus).unwrap_or(0);
                ai.cmp(&bi)
                    .then(a.sortingOrder.cmp(&b.sortingOrder))
                    .then_with(|| a.id.cmp(&b.id))
            });

            Ok(Json(json!({
                "status": "success",
                "payload": list
            })))
        }
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to fetch rushees"
        }))),
    }
}

/// Get notes for rushee
pub async fn get_rushee_notes(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let collection: mongodb::Collection<crate::models::Rushee::RusheeModel> = db::get_rushee_client().await;
    let filter = doc! { "gtid": id.clone() };
    match collection.find_one(filter).await {
        Ok(Some(doc)) => Ok(Json(json!({
            "status": "success",
            "sortingNotes": doc.sorting_notes,
            "sortingTags": doc.sorting_tags,
            "notesUpdatedAt": doc.notes_updated_at,
            "notesUpdatedBy": doc.notes_updated_by,
            "sortingStatus": doc.sorting_status,
        }))),
        Ok(None) => Ok(Json(json!({
            "status": "error",
            "message": "Rushee not found"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to fetch notes"
        }))),
    }
}

/// Update rushee notes (autosave)
pub async fn update_rushee_notes(
    Path(id): Path<String>,
    Extension(user): Extension<crate::middlewares::auth::FirebaseUser>,
    Json(payload): Json<NotesPayload>,
) -> Result<Json<Value>, StatusCode> {
    let collection: mongodb::Collection<crate::models::Rushee::RusheeModel> = db::get_rushee_client().await;
    let filter = doc! { "gtid": id.clone() };

    if payload.sortingNotes.len() > 5000 {
        return Ok(Json(json!({
            "status": "error",
            "message": "Notes too long"
        })));
    }

    // Validate tags
    let valid_tags = ["night_1", "night_2", "closed_night", "closed_night_invite", "pis", "hard_no"];
    let filtered_tags: Vec<&str> = payload.sortingTags
        .iter()
        .filter(|t| valid_tags.contains(&t.as_str()))
        .map(|t| t.as_str())
        .collect();

    let update = doc! {
        "$set": {
            "sorting_notes": &payload.sortingNotes,
            "sorting_tags": &filtered_tags,
            "notes_updated_at": DateTime::now(),
            "notes_updated_by": user.email.clone().unwrap_or(user.uid.clone()),
        }
    };

    match collection.update_one(filter, update).await {
        Ok(_) => Ok(Json(json!({
            "status": "success"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to update notes"
        }))),
    }
}

/// Update sorting status and order for a single rushee (used on drop)
pub async fn update_rushee_sorting(
    Path(id): Path<String>,
    Extension(user): Extension<crate::middlewares::auth::FirebaseUser>,
    Json(payload): Json<UpdateSortingPayload>,
) -> Result<Json<Value>, StatusCode> {
    if !validate_status(&payload.sortingStatus) {
        return Ok(Json(json!({
            "status": "error",
            "message": "Invalid sorting status"
        })));
    }

    let collection: mongodb::Collection<crate::models::Rushee::RusheeModel> = db::get_rushee_client().await;
    let filter = doc! { "gtid": id.clone() };

    let update = doc! {
        "$set": {
            "sorting_status": &payload.sortingStatus,
            "sorting_order": payload.sortingOrder,
            "status_updated_at": DateTime::now(),
            "status_updated_by": user.email.clone().unwrap_or(user.uid.clone()),
        }
    };

    match collection.update_one(filter, update).await {
        Ok(_) => Ok(Json(json!({
            "status": "success"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to update sorting status"
        }))),
    }
}

/// Bulk reorder a column (and set status)
pub async fn bulk_reorder(
    Extension(user): Extension<crate::middlewares::auth::FirebaseUser>,
    Json(payload): Json<BulkReorderPayload>,
) -> Result<Json<Value>, StatusCode> {
    let _lock = SORTING_REORDER_LOCK.lock().await;

    if !validate_status(&payload.column) {
        return Ok(Json(json!({
            "status": "error",
            "message": "Invalid column"
        })));
    }

    let collection: mongodb::Collection<crate::models::Rushee::RusheeModel> = db::get_rushee_client().await;

    for (idx, id_str) in payload.orderedRusheeIds.iter().enumerate() {
        let filter = doc! { "gtid": id_str };
        let update = doc! {
            "$set": {
                "sorting_status": &payload.column,
                "sorting_order": (idx as i32) + 1,
                "status_updated_at": DateTime::now(),
                "status_updated_by": user.email.clone().unwrap_or(user.uid.clone()),
            }
        };
        if let Err(_) = collection.update_one(filter, update).await {
            return Ok(Json(json!({
                "status": "error",
                "message": "Failed to reorder"
            })));
        }
    }

    Ok(Json(json!({
        "status": "success"
    })))
}

/// Move a single rushee within or across columns using current DB order
pub async fn move_rushee(
    Extension(user): Extension<crate::middlewares::auth::FirebaseUser>,
    Json(payload): Json<MoveRusheePayload>,
) -> Result<Json<Value>, StatusCode> {
    if !validate_status(&payload.fromColumn) || !validate_status(&payload.toColumn) {
        return Ok(Json(json!({
            "status": "error",
            "message": "Invalid column"
        })));
    }

    let from_column = payload.fromColumn.clone();
    let to_column = payload.toColumn.clone();

    // Acquire column locks in deterministic order to avoid deadlocks
    let (first, second) = if from_column <= to_column {
        (from_column.clone(), to_column.clone())
    } else {
        (to_column.clone(), from_column.clone())
    };

    let first_lock = SORTING_COLUMN_LOCKS
        .get(&first)
        .cloned()
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    let _guard_first = first_lock.lock().await;
    let second_lock = if first != second {
        Some(
            SORTING_COLUMN_LOCKS
                .get(&second)
                .cloned()
                .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?,
        )
    } else {
        None
    };
    let _guard_second = if let Some(lock) = &second_lock {
        Some(lock.lock().await)
    } else {
        None
    };

    let collection: mongodb::Collection<crate::models::Rushee::RusheeModel> =
        db::get_rushee_client().await;

    async fn fetch_ids(
        collection: &mongodb::Collection<crate::models::Rushee::RusheeModel>,
        column: &str,
    ) -> Result<Vec<String>, StatusCode> {
        let cursor = collection.find(doc! { "sorting_status": column }).await;
        match cursor {
            Ok(mut cursor) => {
                let mut items: Vec<(i32, String)> = Vec::new();
                while let Some(item) = cursor.next().await {
                    if let Ok(doc) = item {
                        items.push((doc.sorting_order, doc.gtid));
                    }
                }
                items.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.cmp(&b.1)));
                Ok(items.into_iter().map(|(_, id)| id).collect())
            }
            Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
        }
    }

    let target_index = if payload.targetIndex < 0 {
        0
    } else {
        payload.targetIndex as usize
    };

    if from_column == to_column {
        let mut ids: Vec<String> = fetch_ids(&collection, &from_column).await?;
        let pos = ids.iter().position(|id| id == &payload.movedRusheeId);
        let Some(pos) = pos else {
            return Ok(Json(json!({
                "status": "error",
                "message": "Rushee not found in source column"
            })));
        };
        ids.remove(pos);
        let insert_at = std::cmp::min(target_index, ids.len());
        ids.insert(insert_at, payload.movedRusheeId.clone());

        for (idx, id_str) in ids.iter().enumerate() {
            let filter = doc! { "gtid": id_str };
            let update = doc! {
                "$set": {
                    "sorting_status": &from_column,
                    "sorting_order": (idx as i32) + 1,
                    "status_updated_at": DateTime::now(),
                    "status_updated_by": user.email.clone().unwrap_or(user.uid.clone()),
                }
            };
            if let Err(_) = collection.update_one(filter, update).await {
                return Ok(Json(json!({
                    "status": "error",
                    "message": "Failed to move rushee"
                })));
            }
        }
    } else {
        let mut from_ids: Vec<String> = fetch_ids(&collection, &from_column).await?;
        let mut to_ids: Vec<String> = fetch_ids(&collection, &to_column).await?;

        let pos = from_ids.iter().position(|id| id == &payload.movedRusheeId);
        let Some(pos) = pos else {
            return Ok(Json(json!({
                "status": "error",
                "message": "Rushee not found in source column"
            })));
        };
        from_ids.remove(pos);
        let insert_at = std::cmp::min(target_index, to_ids.len());
        to_ids.insert(insert_at, payload.movedRusheeId.clone());

        for (idx, id_str) in from_ids.iter().enumerate() {
            let filter = doc! { "gtid": id_str };
            let update = doc! {
                "$set": {
                    "sorting_status": &from_column,
                    "sorting_order": (idx as i32) + 1,
                    "status_updated_at": DateTime::now(),
                    "status_updated_by": user.email.clone().unwrap_or(user.uid.clone()),
                }
            };
            if let Err(_) = collection.update_one(filter, update).await {
                return Ok(Json(json!({
                    "status": "error",
                    "message": "Failed to move rushee"
                })));
            }
        }

        for (idx, id_str) in to_ids.iter().enumerate() {
            let filter = doc! { "gtid": id_str };
            let update = doc! {
                "$set": {
                    "sorting_status": &to_column,
                    "sorting_order": (idx as i32) + 1,
                    "status_updated_at": DateTime::now(),
                    "status_updated_by": user.email.clone().unwrap_or(user.uid.clone()),
                }
            };
            if let Err(_) = collection.update_one(filter, update).await {
                return Ok(Json(json!({
                    "status": "error",
                    "message": "Failed to move rushee"
                })));
            }
        }
    }

    Ok(Json(json!({
        "status": "success"
    })))
}


#[derive(serde::Deserialize)]
pub struct AdminTogglePayload {
    pub uid: String,
    #[serde(default)]
    pub make_admin: Option<bool>,
}

#[derive(serde::Deserialize)]
pub struct AdminStatusPayload {
    pub uid: String,
}

/// Promote/demote a brother to admin (protected by admin middleware)
pub async fn make_admin(
    State(auth): State<std::sync::Arc<FirebaseAuth>>,
    Json(payload): Json<AdminTogglePayload>,
) -> Result<Json<Value>, StatusCode> {
    let make_admin = payload.make_admin.unwrap_or(true);

    match auth.set_admin_claim(&payload.uid, make_admin).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": if make_admin { "Admin access granted" } else { "Admin access removed" }
        }))),
        Err(crate::middlewares::auth::AuthError::ServiceAccountMissing) => Ok(Json(json!({
            "status": "error",
            "message": "Service account missing on server; cannot update admin claim"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to update admin claim"
        }))),
    }
}

/// Check admin and bidcom status for a given uid
pub async fn get_admin_status(
    State(auth): State<std::sync::Arc<FirebaseAuth>>,
    Json(payload): Json<AdminStatusPayload>,
) -> Result<Json<Value>, StatusCode> {
    match auth.get_user_roles(&payload.uid).await {
        Ok((is_admin, is_bidcom)) => Ok(Json(json!({
            "status": "success",
            "admin": is_admin,
            "bidcom": is_bidcom
        }))),
        Err(crate::middlewares::auth::AuthError::ServiceAccountMissing) => Ok(Json(json!({
            "status": "error",
            "message": "Service account missing on server; cannot read user roles"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to read user roles"
        }))),
    }
}

#[derive(serde::Deserialize)]
pub struct BidcomTogglePayload {
    pub uid: String,
    #[serde(default)]
    pub make_bidcom: Option<bool>,
}

/// Promote/demote a brother to bid committee (protected by admin middleware)
pub async fn make_bidcom(
    State(auth): State<std::sync::Arc<FirebaseAuth>>,
    Json(payload): Json<BidcomTogglePayload>,
) -> Result<Json<Value>, StatusCode> {
    let make_bidcom = payload.make_bidcom.unwrap_or(true);

    match auth.set_bidcom_claim(&payload.uid, make_bidcom).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": if make_bidcom { "Bid committee access granted" } else { "Bid committee access removed" }
        }))),
        Err(crate::middlewares::auth::AuthError::ServiceAccountMissing) => Ok(Json(json!({
            "status": "error",
            "message": "Service account missing on server; cannot update bidcom claim"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to update bidcom claim"
        }))),
    }
}

// ========== PIS Availability System Endpoints ==========

/// Send the PIS availability form to all brothers (activate form)
pub async fn send_pis_availability_form() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_pis_availability_form_status_client().await;
    
    // Delete any existing status document
    let _ = collection.delete_many(doc! {}).await;
    
    // Insert new active status
    let status = PISAvailabilityFormStatus {
        is_active: true,
        sent_at: Some(DateTime::now()),
    };
    
    match collection.insert_one(status).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "PIS availability form sent to all brothers"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to send form"
        }))),
    }
}

/// Clear all availability submissions and resend the form
pub async fn clear_and_resend_pis_availability_form() -> Result<Json<Value>, StatusCode> {
    // Clear all brother availability submissions
    let availability_collection = db::get_brother_pis_availability_client().await;
    if let Err(_) = availability_collection.delete_many(doc! {}).await {
        return Ok(Json(json!({
            "status": "error",
            "message": "Failed to clear availability submissions"
        })));
    }
    
    // Reset and activate the form
    let form_collection = db::get_pis_availability_form_status_client().await;
    let _ = form_collection.delete_many(doc! {}).await;
    
    let status = PISAvailabilityFormStatus {
        is_active: true,
        sent_at: Some(DateTime::now()),
    };
    
    match form_collection.insert_one(status).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "Cleared all submissions and resent form"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to resend form"
        }))),
    }
}

/// Check if the PIS availability form is currently active
pub async fn get_pis_availability_form_status() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_pis_availability_form_status_client().await;
    
    match collection.find_one(doc! {}).await {
        Ok(Some(status)) => Ok(Json(json!({
            "status": "success",
            "is_active": status.is_active,
            "sent_at": status.sent_at
        }))),
        Ok(None) => Ok(Json(json!({
            "status": "success",
            "is_active": false,
            "sent_at": null
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to check form status"
        }))),
    }
}

/// Check if a specific brother needs to fill out the availability form
#[derive(Deserialize)]
pub struct CheckBrotherAvailabilityPayload {
    pub brother_uid: String,
}

pub async fn check_brother_needs_availability_form(
    Json(payload): Json<CheckBrotherAvailabilityPayload>,
) -> Result<Json<Value>, StatusCode> {
    // First check if form is active
    let form_collection = db::get_pis_availability_form_status_client().await;
    let form_status = match form_collection.find_one(doc! {}).await {
        Ok(Some(status)) => status,
        Ok(None) => {
            return Ok(Json(json!({
                "status": "success",
                "needs_form": false
            })));
        }
        Err(_) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "Failed to check form status"
            })));
        }
    };
    
    if !form_status.is_active {
        return Ok(Json(json!({
            "status": "success",
            "needs_form": false
        })));
    }
    
    // Check if brother has already submitted
    let availability_collection = db::get_brother_pis_availability_client().await;
    match availability_collection.find_one(doc! { "brother_uid": &payload.brother_uid }).await {
        Ok(Some(_)) => Ok(Json(json!({
            "status": "success",
            "needs_form": false
        }))),
        Ok(None) => Ok(Json(json!({
            "status": "success",
            "needs_form": true
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to check availability"
        }))),
    }
}

/// Submit brother's PIS availability
pub async fn submit_brother_availability(
    Json(payload): Json<IncomingBrotherAvailability>,
) -> Result<Json<Value>, StatusCode> {
    let collection = db::get_brother_pis_availability_client().await;
    
    // Convert timeslot strings to DateTime
    let timeslots: Vec<DateTime> = payload.available_timeslots
        .iter()
        .map(|t| string_to_bson_datetime(t))
        .collect();
    
    let availability = BrotherPISAvailability {
        brother_uid: payload.brother_uid.clone(),
        brother_email: payload.brother_email,
        brother_first_name: payload.brother_first_name,
        brother_last_name: payload.brother_last_name,
        available_timeslots: timeslots,
        submitted_at: DateTime::now(),
    };
    
    // Upsert - update if exists, insert if not
    let filter = doc! { "brother_uid": &payload.brother_uid };
    let _ = collection.delete_one(filter).await;
    
    match collection.insert_one(availability).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "Availability submitted successfully"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to submit availability"
        }))),
    }
}

/// Get all brother availabilities (admin view)
pub async fn get_all_brother_availabilities() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_brother_pis_availability_client().await;
    
    match collection.find(doc! {}).await {
        Ok(mut cursor) => {
            let mut availabilities: Vec<BrotherPISAvailability> = Vec::new();
            while let Some(item) = cursor.next().await {
                if let Ok(avail) = item {
                    availabilities.push(avail);
                }
            }
            Ok(Json(json!({
                "status": "success",
                "payload": availabilities
            })))
        }
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to fetch availabilities"
        }))),
    }
}

/// Auto-assign brothers to PIS slots based on availability
pub async fn auto_assign_pis_brothers() -> Result<Json<Value>, StatusCode> {
    // Get all brother availabilities
    let availability_collection = db::get_brother_pis_availability_client().await;
    let mut availability_cursor = match availability_collection.find(doc! {}).await {
        Ok(cursor) => cursor,
        Err(_) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "Failed to fetch brother availabilities"
            })));
        }
    };
    
    let mut brother_availabilities: Vec<BrotherPISAvailability> = Vec::new();
    while let Some(item) = availability_cursor.next().await {
        if let Ok(avail) = item {
            brother_availabilities.push(avail);
        }
    }
    
    if brother_availabilities.is_empty() {
        return Ok(Json(json!({
            "status": "error",
            "message": "No brother availabilities found. Have brothers fill out the form first."
        })));
    }
    
    // Build a map of timeslot -> available brothers (with separate first/last names)
    let mut timeslot_to_brothers: HashMap<i64, Vec<(String, String)>> = HashMap::new();
    for avail in &brother_availabilities {
        // Validate that we have proper first and last names (not empty, not containing the full name)
        let first_name = avail.brother_first_name.trim().to_string();
        let last_name = avail.brother_last_name.trim().to_string();
        
        // Skip if names look invalid
        if first_name.is_empty() || last_name.is_empty() {
            continue;
        }
        
        for ts in &avail.available_timeslots {
            let ts_millis = ts.timestamp_millis();
            let entry = timeslot_to_brothers.entry(ts_millis).or_insert_with(Vec::new);
            entry.push((first_name.clone(), last_name.clone()));
        }
    }
    
    // Track how many PIS each brother is assigned to TOTAL (for load balancing)
    let mut brother_total_assignments: HashMap<String, i32> = HashMap::new();
    
    // Track which brothers are already assigned to each timeslot
    // Key: timeslot millis, Value: set of brother full names already assigned at this time
    let mut timeslot_assigned_brothers: HashMap<i64, std::collections::HashSet<String>> = HashMap::new();
    
    // Get all rushees with PIS signups - collect them first to process in order
    let rushee_collection = db::get_rushee_client().await;
    let mut rushee_cursor = match rushee_collection.find(doc! {}).await {
        Ok(cursor) => cursor,
        Err(_) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "Failed to fetch rushees"
            })));
        }
    };
    
    // Collect all rushees first
    let mut rushees: Vec<crate::models::Rushee::RusheeModel> = Vec::new();
    while let Some(item) = rushee_cursor.next().await {
        if let Ok(rushee) = item {
            rushees.push(rushee);
        }
    }
    
    // First pass: record existing assignments to prevent conflicts
    for rushee in &rushees {
        let ts_millis = rushee.pis_timeslot.timestamp_millis();
        let assigned_set = timeslot_assigned_brothers.entry(ts_millis).or_insert_with(std::collections::HashSet::new);
        
        // Record first brother if assigned
        if rushee.pis_signup.first_brother_first_name != "none" {
            let key = format!("{} {}", 
                rushee.pis_signup.first_brother_first_name.trim(), 
                rushee.pis_signup.first_brother_last_name.trim()
            );
            assigned_set.insert(key.clone());
            *brother_total_assignments.entry(key).or_insert(0) += 1;
        }
        
        // Record second brother if assigned
        if rushee.pis_signup.second_brother_first_name != "none" {
            let key = format!("{} {}", 
                rushee.pis_signup.second_brother_first_name.trim(), 
                rushee.pis_signup.second_brother_last_name.trim()
            );
            assigned_set.insert(key.clone());
            *brother_total_assignments.entry(key).or_insert(0) += 1;
        }
    }
    
    let mut assignments_made = 0;
    let mut assignment_failures = 0;
    
    // Second pass: make new assignments
    for rushee in &rushees {
        let ts_millis = rushee.pis_timeslot.timestamp_millis();
        
        // Skip if both brothers are already assigned
        if rushee.pis_signup.first_brother_first_name != "none" 
            && rushee.pis_signup.second_brother_first_name != "none" {
            continue;
        }
        
        // Get available brothers for this timeslot
        let available_brothers = match timeslot_to_brothers.get(&ts_millis) {
            Some(bros) => bros.clone(),
            None => {
                assignment_failures += 1;
                continue;
            }
        };
        
        if available_brothers.is_empty() {
            assignment_failures += 1;
            continue;
        }
        
        // Get the set of brothers already assigned to this timeslot
        let assigned_at_timeslot = timeslot_assigned_brothers.entry(ts_millis)
            .or_insert_with(std::collections::HashSet::new);
        
        // Filter out brothers who are already assigned to another PIS at this same timeslot
        let mut eligible_brothers: Vec<(String, String)> = available_brothers
            .iter()
            .filter(|(first, last)| {
                let key = format!("{} {}", first.trim(), last.trim());
                !assigned_at_timeslot.contains(&key)
            })
            .cloned()
            .collect();
        
        // Sort by total assignment count (ascending) for load balancing
        eligible_brothers.sort_by(|a, b| {
            let key_a = format!("{} {}", a.0, a.1);
            let key_b = format!("{} {}", b.0, b.1);
            let count_a = brother_total_assignments.get(&key_a).unwrap_or(&0);
            let count_b = brother_total_assignments.get(&key_b).unwrap_or(&0);
            count_a.cmp(count_b)
        });
        
        // Get current assignments for this rushee
        let mut first_assigned = (
            rushee.pis_signup.first_brother_first_name.clone(),
            rushee.pis_signup.first_brother_last_name.clone()
        );
        let mut update_first = false;
        
        let mut second_assigned = (
            rushee.pis_signup.second_brother_first_name.clone(),
            rushee.pis_signup.second_brother_last_name.clone()
        );
        let mut update_second = false;
        
        // Track if rushee needed assignments
        let needed_first = first_assigned.0 == "none";
        let needed_second = second_assigned.0 == "none";
        
        // Assign first brother if needed
        if needed_first {
            if let Some(bro) = eligible_brothers.first() {
                first_assigned = (bro.0.clone(), bro.1.clone());
                update_first = true;
                let key = format!("{} {}", bro.0, bro.1);
                *brother_total_assignments.entry(key.clone()).or_insert(0) += 1;
                assigned_at_timeslot.insert(key);
            }
        }
        
        // Assign second brother if needed (must be different from first)
        if needed_second {
            let first_key = format!("{} {}", first_assigned.0.trim(), first_assigned.1.trim());
            
            // Re-filter eligible brothers (excluding the first assigned and already assigned at timeslot)
            let mut second_eligible: Vec<(String, String)> = available_brothers
                .iter()
                .filter(|(first, last)| {
                    let key = format!("{} {}", first.trim(), last.trim());
                    // Not already assigned at this timeslot AND not the first brother
                    !assigned_at_timeslot.contains(&key) && key != first_key
                })
                .cloned()
                .collect();
            
            // Sort by total assignments
            second_eligible.sort_by(|a, b| {
                let key_a = format!("{} {}", a.0, a.1);
                let key_b = format!("{} {}", b.0, b.1);
                let count_a = brother_total_assignments.get(&key_a).unwrap_or(&0);
                let count_b = brother_total_assignments.get(&key_b).unwrap_or(&0);
                count_a.cmp(count_b)
            });
            
            if let Some(bro) = second_eligible.first() {
                second_assigned = (bro.0.clone(), bro.1.clone());
                update_second = true;
                let key = format!("{} {}", bro.0, bro.1);
                *brother_total_assignments.entry(key.clone()).or_insert(0) += 1;
                assigned_at_timeslot.insert(key);
            }
        }
        
        // Check if rushee still has unassigned slots after our attempt
        let still_missing_first = needed_first && !update_first;
        let still_missing_second = needed_second && !update_second;
        
        // Update rushee if any assignments were made
        if update_first || update_second {
            let mut update_doc = doc! {};
            if update_first {
                update_doc.insert("pis_signup.first_brother_first_name", first_assigned.0.trim());
                update_doc.insert("pis_signup.first_brother_last_name", first_assigned.1.trim());
            }
            if update_second {
                update_doc.insert("pis_signup.second_brother_first_name", second_assigned.0.trim());
                update_doc.insert("pis_signup.second_brother_last_name", second_assigned.1.trim());
            }
            
            let filter = doc! { "gtid": &rushee.gtid };
            let update = doc! { "$set": update_doc };
            
            if let Ok(_) = rushee_collection.update_one(filter, update).await {
                assignments_made += 1;
            }
            
            // If we made some assignments but still missing brothers, count as partial failure
            if still_missing_first || still_missing_second {
                assignment_failures += 1;
            }
        } else if needed_first || needed_second {
            // Rushee needed assignments but we couldn't make any (all brothers at this time are busy)
            assignment_failures += 1;
        }
    }
    
    Ok(Json(json!({
        "status": "success",
        "message": format!("Assigned brothers to {} PIS slots. {} slots could not be fully assigned (all available brothers at that time were busy).", 
                          assignments_made, assignment_failures)
    })))
}

/// Clear all brother assignments from PIS slots
pub async fn clear_pis_assignments() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_rushee_client().await;
    
    let update = doc! {
        "$set": {
            "pis_signup.first_brother_first_name": "none",
            "pis_signup.first_brother_last_name": "none",
            "pis_signup.second_brother_first_name": "none",
            "pis_signup.second_brother_last_name": "none"
        }
    };
    
    match collection.update_many(doc! {}, update).await {
        Ok(result) => Ok(Json(json!({
            "status": "success",
            "message": format!("Cleared assignments from {} rushees", result.modified_count)
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to clear assignments"
        }))),
    }
}

/// Export PIS schedule with brother assignments as CSV data
pub async fn export_pis_with_brothers() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_rushee_client().await;
    
    match collection.find(doc! {}).await {
        Ok(mut cursor) => {
            let mut export_data: Vec<serde_json::Value> = Vec::new();
            
            while let Some(item) = cursor.next().await {
                if let Ok(rushee) = item {
                    export_data.push(json!({
                        "rushee_name": format!("{} {}", rushee.first_name, rushee.last_name),
                        "timeslot": rushee.pis_timeslot,
                        "brother_1": format!("{} {}", 
                            rushee.pis_signup.first_brother_first_name,
                            rushee.pis_signup.first_brother_last_name
                        ),
                        "brother_2": format!("{} {}", 
                            rushee.pis_signup.second_brother_first_name,
                            rushee.pis_signup.second_brother_last_name
                        )
                    }));
                }
            }
            
            // Sort by timeslot
            export_data.sort_by(|a, b| {
                let ts_a = a["timeslot"]["$date"]["$numberLong"].as_str().unwrap_or("0");
                let ts_b = b["timeslot"]["$date"]["$numberLong"].as_str().unwrap_or("0");
                ts_a.cmp(ts_b)
            });
            
            Ok(Json(json!({
                "status": "success",
                "payload": export_data
            })))
        }
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to export data"
        }))),
    }
}

/// Deactivate the PIS availability form
pub async fn deactivate_pis_availability_form() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_pis_availability_form_status_client().await;
    
    let update = doc! { "$set": { "is_active": false } };
    
    match collection.update_many(doc! {}, update).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "Form deactivated"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to deactivate form"
        }))),
    }
}

// ========== Rush App Disable System Endpoints ==========

/// Update Rush App access settings (independent toggles for bidcom and regular brothers)
pub async fn update_rush_app_settings(
    Extension(user): Extension<crate::middlewares::auth::FirebaseUser>,
    Json(payload): Json<UpdateRushAppPayload>,
) -> Result<Json<Value>, StatusCode> {
    let collection = db::get_rush_app_status_client().await;
    
    // Delete any existing status document
    let _ = collection.delete_many(doc! {}).await;
    
    // Insert new status
    let status = RushAppStatus {
        disable_bidcom: payload.disable_bidcom,
        disable_regular: payload.disable_regular,
        updated_at: Some(DateTime::now()),
        updated_by: Some(user.email.clone().unwrap_or(user.uid.clone())),
    };
    
    match collection.insert_one(status).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "Rush App settings updated"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to update Rush App settings"
        }))),
    }
}

/// Get current Rush App status (admin only)
pub async fn get_rush_app_status() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_rush_app_status_client().await;
    
    match collection.find_one(doc! {}).await {
        Ok(Some(status)) => Ok(Json(json!({
            "status": "success",
            "disable_bidcom": status.disable_bidcom,
            "disable_regular": status.disable_regular,
            "updated_at": status.updated_at,
            "updated_by": status.updated_by
        }))),
        Ok(None) => Ok(Json(json!({
            "status": "success",
            "disable_bidcom": false,
            "disable_regular": false,
            "updated_at": null,
            "updated_by": null
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to fetch Rush App status"
        }))),
    }
}

/// Check if a brother can access the Rush App (public endpoint)
/// Admins always have access, regardless of disable settings
pub async fn check_rush_app_access(
    Json(payload): Json<CheckAccessPayload>,
) -> Result<Json<Value>, StatusCode> {
    // Admins always have access
    if payload.is_admin {
        return Ok(Json(json!({
            "status": "success",
            "allowed": true,
            "reason": null
        })));
    }
    
    let collection = db::get_rush_app_status_client().await;
    
    match collection.find_one(doc! {}).await {
        Ok(Some(status)) => {
            // Check if user is bid committee (but not admin - already checked above)
            if payload.is_bidcom {
                // User is bid committee member
                if status.disable_bidcom {
                    return Ok(Json(json!({
                        "status": "success",
                        "allowed": false,
                        "reason": "The Rush App has been temporarily disabled for bid committee members."
                    })));
                } else {
                    return Ok(Json(json!({
                        "status": "success",
                        "allowed": true,
                        "reason": null
                    })));
                }
            }
            
            // User is a regular brother (not admin, not bidcom)
            if status.disable_regular {
                return Ok(Json(json!({
                    "status": "success",
                    "allowed": false,
                    "reason": "The Rush App has been temporarily disabled by an administrator."
                })));
            }
            
            // Not disabled for this user type
            Ok(Json(json!({
                "status": "success",
                "allowed": true,
                "reason": null
            })))
        }
        Ok(None) => {
            // No status document means app is enabled for everyone
            Ok(Json(json!({
                "status": "success",
                "allowed": true,
                "reason": null
            })))
        }
        Err(_) => {
            // On error, allow access to be safe
            Ok(Json(json!({
                "status": "error",
                "message": "Failed to check access status"
            })))
        }
    }
}
