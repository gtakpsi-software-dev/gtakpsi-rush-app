use crate::storage::db;
use axum::{http::StatusCode, response::Json};
use serde_json::{json, Value};

mod clear;
mod execution;
mod loading;
mod persistence;
mod planning;
pub use clear::clear_pis_assignments;
use execution::assign_rushees;
use loading::{load_brother_availabilities, load_rushees};
use planning::index_availability;

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

    let counts = assign_rushees(&rushee_collection, &rushees, &timeslot_to_brothers).await;

    Ok(Json(json!({
        "status": "success",
        "message": format!("Assigned brothers to {} PIS slots. {} slots could not be fully assigned (all available brothers at that time were busy).",
                          counts.assignments_made, counts.assignment_failures)
    })))
}
