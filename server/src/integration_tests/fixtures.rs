use axum::{extract::Path, Json};
use bson::{doc, DateTime};
use serde_json::{json, Value};

use crate::{
    controllers::{db, rushee},
    models::rushee::RusheeModel,
};

pub const GTID: &str = "900000001";
pub const SLOT: &str = "2030-01-01T18:00:00Z";

pub fn path() -> Path<String> {
    Path(GTID.to_string())
}

pub async fn reset() {
    let client = db::get_mongo_client().await;
    for name in [
        "rushees",
        "pis-timeslots",
        "rush-nights",
        "pis-questions",
        "brother-pis-availability",
    ] {
        client
            .database("rush-app")
            .collection::<bson::Document>(name)
            .delete_many(doc! {})
            .await
            .unwrap();
    }
}

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

pub async fn add_slot(time: &str, capacity: i32) {
    db::get_pis_timeslots_client()
        .await
        .insert_one(crate::models::pis::PISTimeslot {
            time: DateTime::parse_rfc3339_str(time).unwrap(),
            num_available: capacity,
        })
        .await
        .unwrap();
}

pub async fn register() -> String {
    add_slot(SLOT, 2).await;
    let response = rushee::signup(Json(serde_json::from_value(signup_payload()).unwrap()))
        .await
        .unwrap()
        .0;
    assert_eq!(response["status"], "success");
    response["payload"].as_str().unwrap().to_string()
}

pub async fn stored_rushee() -> RusheeModel {
    db::get_rushee_client()
        .await
        .find_one(doc! {"gtid": GTID})
        .await
        .unwrap()
        .unwrap()
}

pub async fn capacity(time: &str) -> i32 {
    db::get_pis_timeslots_client()
        .await
        .find_one(doc! {
            "time": DateTime::parse_rfc3339_str(time).unwrap()
        })
        .await
        .unwrap()
        .unwrap()
        .num_available
}
