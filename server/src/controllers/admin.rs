mod sorting;
pub use sorting::{get_sorting_rushees, get_sorting_rushees_public, get_rushee_notes, update_rushee_notes, update_rushee_sorting, bulk_reorder, move_rushee};

mod questions;
pub use questions::{add_pis_question, update_pis_question_category, delete_pis_question, get_pis_questions};

mod timeslots;
pub use timeslots::{add_pis_timeslot, delete_pis_timeslot, get_pis_timeslots};

mod rush_nights;
pub use rush_nights::{add_rush_night, delete_rush_night};

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use futures::stream::StreamExt;
use mongodb::bson::{doc, DateTime};
use serde_json::{json, Value};
use serde::Deserialize;
use axum::extract::Extension;
use std::collections::HashMap;

use crate::{
    middlewares::time_helpers::string_to_bson_datetime,
    models::{
        misc::{IncomingBrotherName},
        pis::{IncomingPISSignup, PISAvailabilityFormStatus, BrotherPISAvailability, IncomingBrotherAvailability, RushAppStatus, UpdateRushAppPayload, CheckAccessPayload, CommentVisibilitySettings, UpdateCommentVisibilityPayload},
        rushee::StrippedRushee,
    },
    middlewares::rush_nights::interactions_by_night,
    middlewares::auth::FirebaseAuth,
};

use super::db;

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
    let rush_nights = crate::middlewares::attendance::get_rush_nights_sorted()
        .await
        .unwrap_or_default();

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
                                registration_order: 0,  // Not used in this context
                                pis_timeslot: Some(doc.pis_timeslot),
                                interactions_by_night: night_interactions,
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

/**
 * Export all rushee personal/registration info (PII) for spreadsheet download.
 * Returns: first_name, last_name, gtid, email, phone_number, housing, major, class, pronouns, exposure
 */
pub async fn export_rushee_personal_info() -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    let result = connection
        .find(doc! {})
        .await;

    match result {
        Ok(mut cursor) => {
            let mut rushees_info = Vec::<serde_json::Value>::new();

            while let Some(rushee) = cursor.next().await {
                match rushee {
                    Ok(doc) => {
                        rushees_info.push(json!({
                            "first_name": doc.first_name,
                            "last_name": doc.last_name,
                            "gtid": doc.gtid,
                            "email": doc.email,
                            "phone_number": doc.phone_number,
                            "housing": doc.housing,
                            "major": doc.major,
                            "class": doc.class,
                            "pronouns": doc.pronouns,
                            "exposure": doc.exposure,
                        }));
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
                "payload": rushees_info
            })))
        }

        Err(_err) => Ok(Json(json!({
            "status": "error",
            "message": "Database error"
        }))),
    }
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
    let mut rushees: Vec<crate::models::rushee::RusheeModel> = Vec::new();
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
        midterm_mode: payload.midterm_mode,
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
            "midterm_mode": status.midterm_mode,
            "updated_at": status.updated_at,
            "updated_by": status.updated_by
        }))),
        Ok(None) => Ok(Json(json!({
            "status": "success",
            "disable_bidcom": false,
            "disable_regular": false,
            "midterm_mode": false,
            "updated_at": null,
            "updated_by": null
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to fetch Rush App status"
        }))),
    }
}

/// Get midterm mode status (public endpoint, no auth required)
pub async fn get_midterm_mode_status() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_rush_app_status_client().await;

    match collection.find_one(doc! {}).await {
        Ok(Some(status)) => Ok(Json(json!({
            "status": "success",
            "midterm_mode": status.midterm_mode
        }))),
        Ok(None) => Ok(Json(json!({
            "status": "success",
            "midterm_mode": false
        }))),
        Err(_) => Ok(Json(json!({
            "status": "success",
            "midterm_mode": false
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

// ========== Comment Visibility Settings Endpoints ==========

/// Update comment visibility settings (admin only)
/// When enabled, brothers only see their own comments on a rushee
pub async fn update_comment_visibility_settings(
    Extension(user): Extension<crate::middlewares::auth::FirebaseUser>,
    Json(payload): Json<UpdateCommentVisibilityPayload>,
) -> Result<Json<Value>, StatusCode> {
    let collection = db::get_comment_visibility_settings_client().await;
    
    // Delete any existing settings document
    let _ = collection.delete_many(doc! {}).await;
    
    // Insert new settings
    let settings = CommentVisibilitySettings {
        require_comment_to_view: payload.require_comment_to_view,
        updated_at: Some(DateTime::now()),
        updated_by: Some(user.email.clone().unwrap_or(user.uid.clone())),
    };
    
    match collection.insert_one(settings).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "Comment visibility settings updated"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to update comment visibility settings"
        }))),
    }
}

/// Get current comment visibility settings (admin only)
pub async fn get_comment_visibility_settings() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_comment_visibility_settings_client().await;
    
    match collection.find_one(doc! {}).await {
        Ok(Some(settings)) => Ok(Json(json!({
            "status": "success",
            "require_comment_to_view": settings.require_comment_to_view,
            "updated_at": settings.updated_at,
            "updated_by": settings.updated_by
        }))),
        Ok(None) => Ok(Json(json!({
            "status": "success",
            "require_comment_to_view": true,  // Default to enabled (existing behavior)
            "updated_at": null,
            "updated_by": null
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to fetch comment visibility settings"
        }))),
    }
}

/// Public endpoint to check if comment visibility restriction is enabled
pub async fn get_comment_visibility_status() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_comment_visibility_settings_client().await;
    
    match collection.find_one(doc! {}).await {
        Ok(Some(settings)) => Ok(Json(json!({
            "status": "success",
            "require_comment_to_view": settings.require_comment_to_view
        }))),
        Ok(None) => Ok(Json(json!({
            "status": "success",
            "require_comment_to_view": true  // Default to enabled (existing behavior)
        }))),
        Err(_) => Ok(Json(json!({
            "status": "success",
            "require_comment_to_view": true  // On error, default to existing behavior
        }))),
    }
}
