use crate::controllers::db;
use crate::models::pis::BrotherPISAvailability;
use axum::{http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::doc;
use serde_json::{json, Value};
use std::collections::HashMap;

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
            let entry = timeslot_to_brothers
                .entry(ts_millis)
                .or_insert_with(Vec::new);
            entry.push((first_name.clone(), last_name.clone()));
        }
    }

    // Track how many PIS each brother is assigned to TOTAL (for load balancing)
    let mut brother_total_assignments: HashMap<String, i32> = HashMap::new();

    // Track which brothers are already assigned to each timeslot
    // Key: timeslot millis, Value: set of brother full names already assigned at this time
    let mut timeslot_assigned_brothers: HashMap<i64, std::collections::HashSet<String>> =
        HashMap::new();

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
        let assigned_set = timeslot_assigned_brothers
            .entry(ts_millis)
            .or_insert_with(std::collections::HashSet::new);

        // Record first brother if assigned
        if rushee.pis_signup.first_brother_first_name != "none" {
            let key = format!(
                "{} {}",
                rushee.pis_signup.first_brother_first_name.trim(),
                rushee.pis_signup.first_brother_last_name.trim()
            );
            assigned_set.insert(key.clone());
            *brother_total_assignments.entry(key).or_insert(0) += 1;
        }

        // Record second brother if assigned
        if rushee.pis_signup.second_brother_first_name != "none" {
            let key = format!(
                "{} {}",
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
            && rushee.pis_signup.second_brother_first_name != "none"
        {
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
        let assigned_at_timeslot = timeslot_assigned_brothers
            .entry(ts_millis)
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
            rushee.pis_signup.first_brother_last_name.clone(),
        );
        let mut update_first = false;

        let mut second_assigned = (
            rushee.pis_signup.second_brother_first_name.clone(),
            rushee.pis_signup.second_brother_last_name.clone(),
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
                update_doc.insert(
                    "pis_signup.first_brother_first_name",
                    first_assigned.0.trim(),
                );
                update_doc.insert(
                    "pis_signup.first_brother_last_name",
                    first_assigned.1.trim(),
                );
            }
            if update_second {
                update_doc.insert(
                    "pis_signup.second_brother_first_name",
                    second_assigned.0.trim(),
                );
                update_doc.insert(
                    "pis_signup.second_brother_last_name",
                    second_assigned.1.trim(),
                );
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
