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

use crate::{
    middlewares::timeHelpers::{self, string_to_bson_datetime},
    models::{
        misc::{IncomingBrotherName, IncomingRushNight, RushNight},
        pis::{IncomingPISSignup, PISQuestion, PISTimeslot, PISTimeslotIncoming},
        Rushee::StrippedRushee,
    },
    middlewares::auth::FirebaseAuth,
};

use super::db;

const SORTING_STATUSES: [&str; 5] = [
    "UNSORTED",
    "IN_CLOUD",
    "MID_CLOUD",
    "OUT_CLOUD",
    "INELIGIBLE",
];

/**
 * Add a PIS question
 */
pub async fn add_pis_question(Json(payload): Json<PISQuestion>) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_questions_client().await;

    let new_question = PISQuestion {
        question: payload.question,
        question_type: payload.question_type,
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

    let result = connection
        .find({
            doc! {}
        })
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

    let result = connection
        .find(doc! {})
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

    let cursor_result = collection.find(doc! {}).await;
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
                ai.cmp(&bi).then(a.sortingOrder.cmp(&b.sortingOrder))
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

    let cursor_result = collection.find(doc! {}).await;
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
                ai.cmp(&bi).then(a.sortingOrder.cmp(&b.sortingOrder))
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
    let valid_tags = ["night_1", "night_2", "closed_night", "hard_no"];
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
