use axum::{extract::Path, Json};
use bson::{doc, DateTime};
use serde_json::{json, Value};

use crate::{controllers::rushee, models::rushee::RusheeModel, storage::db};

pub const GTID: &str = "900000001";
pub const SLOT: &str = "2030-01-01T18:00:00Z";

// Build the standard test rushee's GTID path parameter.
pub fn path() -> Path<String> {
    Path(GTID.to_string())
}

// Clear fixture collections in the disposable database verified by the integration entry point.
pub async fn reset() {
    let client = db::get_mongo_client().await;
    for name in [
        "rushees",
        "pis-timeslots",
        "rush-nights",
        "pis-questions",
        "brother-pis-availability",
        "pis-availability-form-status",
        "rush-app-status",
        "comment-visibility-settings",
    ] {
        client
            .database("rush-app")
            .collection::<bson::Document>(name)
            .delete_many(doc! {})
            .await
            .unwrap();
    }
}

// Build the standard test rushee's registration request.
pub fn signup_payload() -> Value {
    json!({
        "first_name": "Test", "last_name": "Rushee", "housing": "Campus",
        "phone_number": "(404) 555-0100", "email": "test@example.invalid",
        "gtid": GTID, "major": "Business", "class": "First Year",
        "pronouns": "they/them", "image_url": "headshot", "exposure": "Event",
        "pis_meeting_id": "meeting", "pis_timeslot": SLOT, "pis_link": "interview",
        "flex_window": false
    })
}

// Insert a fixture PIS timeslot with the requested capacity.
pub async fn add_slot(time: &str, capacity: i32) {
    db::get_pis_timeslots_collection()
        .await
        .insert_one(crate::models::pis::PISTimeslot {
            time: DateTime::parse_rfc3339_str(time).unwrap(),
            num_available: capacity,
        })
        .await
        .unwrap();
}

// Create the standard fixture rushee and return its generated access code.
pub async fn register() -> String {
    add_slot(SLOT, 2).await;
    let response = rushee::signup(Json(serde_json::from_value(signup_payload()).unwrap()))
        .await
        .unwrap()
        .0;
    assert_eq!(response["status"], "success");
    response["payload"].as_str().unwrap().to_string()
}

// Load the standard fixture rushee from MongoDB.
pub async fn stored_rushee() -> RusheeModel {
    db::get_rushee_collection()
        .await
        .find_one(doc! {"gtid": GTID})
        .await
        .unwrap()
        .unwrap()
}

// Read the remaining capacity of a fixture timeslot.
pub async fn capacity(time: &str) -> i32 {
    db::get_pis_timeslots_collection()
        .await
        .find_one(doc! {
            "time": DateTime::parse_rfc3339_str(time).unwrap()
        })
        .await
        .unwrap()
        .unwrap()
        .num_available
}
