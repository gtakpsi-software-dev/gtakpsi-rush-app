use crate::controllers::db;
use crate::models::pis::BrotherPISAvailability;
use crate::models::rushee::RusheeModel;
use axum::{http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::doc;
use serde_json::{json, Value};

mod planning;
use planning::{index_availability, AssignmentPlanner};

/// Auto-assign brothers to PIS slots based on availability
pub async fn auto_assign_pis_brothers() -> Result<Json<Value>, StatusCode> {
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

    let timeslot_to_brothers = index_availability(&brother_availabilities);
    let mut planner = AssignmentPlanner::default();

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

    let mut rushees: Vec<RusheeModel> = Vec::new();
    while let Some(item) = rushee_cursor.next().await {
        if let Ok(rushee) = item {
            rushees.push(rushee);
        }
    }

    // Register every existing assignment before choosing new ones so later rushees cannot conflict.
    for rushee in &rushees {
        planner.register_existing(rushee.pis_timeslot.timestamp_millis(), &rushee.pis_signup);
    }

    let mut assignments_made = 0;
    let mut assignment_failures = 0;

    for rushee in &rushees {
        let ts_millis = rushee.pis_timeslot.timestamp_millis();

        if rushee.pis_signup.first_brother_first_name != "none"
            && rushee.pis_signup.second_brother_first_name != "none"
        {
            continue;
        }

        let available_brothers = match timeslot_to_brothers.get(&ts_millis) {
            Some(bros) => bros,
            None => {
                assignment_failures += 1;
                continue;
            }
        };

        if available_brothers.is_empty() {
            assignment_failures += 1;
            continue;
        }

        let plan = planner.plan(ts_millis, &rushee.pis_signup, available_brothers);

        if plan.first.is_some() || plan.second.is_some() {
            let mut update_doc = doc! {};
            if let Some(first) = &plan.first {
                update_doc.insert("pis_signup.first_brother_first_name", first.0.trim());
                update_doc.insert("pis_signup.first_brother_last_name", first.1.trim());
            }
            if let Some(second) = &plan.second {
                update_doc.insert("pis_signup.second_brother_first_name", second.0.trim());
                update_doc.insert("pis_signup.second_brother_last_name", second.1.trim());
            }

            let filter = doc! { "gtid": &rushee.gtid };
            let update = doc! { "$set": update_doc };

            if let Ok(_) = rushee_collection.update_one(filter, update).await {
                assignments_made += 1;
            }

            // A partial assignment still counts as a failed slot, regardless of write outcome.
            if plan.still_missing_first || plan.still_missing_second {
                assignment_failures += 1;
            }
        } else if plan.still_missing_first || plan.still_missing_second {
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
