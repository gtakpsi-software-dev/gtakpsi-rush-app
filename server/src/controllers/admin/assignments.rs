use crate::controllers::db;
use axum::{http::StatusCode, response::Json};
use serde_json::{json, Value};

mod clear;
mod loading;
mod persistence;
mod planning;
pub use clear::clear_pis_assignments;
use loading::{load_brother_availabilities, load_rushees};
use persistence::persist_assignment;
use planning::{index_availability, AssignmentPlanner};

/// Auto-assign brothers to PIS slots based on availability
pub async fn auto_assign_pis_brothers() -> Result<Json<Value>, StatusCode> {
    let brother_availabilities = match load_brother_availabilities().await {
        Ok(availabilities) => availabilities,
        Err(_) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "Failed to fetch brother availabilities"
            })));
        }
    };

    if brother_availabilities.is_empty() {
        return Ok(Json(json!({
            "status": "error",
            "message": "No brother availabilities found. Have brothers fill out the form first."
        })));
    }

    let timeslot_to_brothers = index_availability(&brother_availabilities);
    let mut planner = AssignmentPlanner::default();

    let rushee_collection = db::get_rushee_client().await;
    let rushees = match load_rushees(&rushee_collection).await {
        Ok(rushees) => rushees,
        Err(_) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "Failed to fetch rushees"
            })));
        }
    };

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
            if persist_assignment(&rushee_collection, rushee, &plan).await {
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
