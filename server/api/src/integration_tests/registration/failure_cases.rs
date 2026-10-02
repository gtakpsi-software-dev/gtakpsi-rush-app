use axum::Json;
use bson::{doc, DateTime};
use serde_json::json;

use super::super::fixtures::{add_slot, capacity, path, stored_rushee};
use crate::controllers::{db, rushee};

pub(super) async fn check_reschedule_write_failure(old_slot: &str) {
    let new_slot = "2030-01-04T18:00:00Z";
    add_slot(new_slot, 1).await;
    let old_time = DateTime::parse_rfc3339_str(old_slot).unwrap();
    let database = db::get_mongo_client().await.database("rush-app");

    // Reject only the final rushee write so both earlier capacity changes remain observable.
    database
        .run_command(doc! {
            "collMod": "rushees",
            "validator": { "$jsonSchema": {
                "bsonType": "object",
                "properties": { "pis_timeslot": { "enum": [old_time] } }
            } }
        })
        .await
        .unwrap();
    assert_eq!(
        rushee::reschedule_pis(path(), Json(new_slot.to_string()))
            .await
            .unwrap()
            .0,
        json!({"status": "error", "message": "Failed to update rushee record"})
    );
    assert_eq!(capacity(old_slot).await, 1);
    assert_eq!(capacity(new_slot).await, 0);
    let stored = stored_rushee().await;
    assert_eq!(stored.pis_timeslot, old_time);
    assert_eq!(stored.pis_signup.time, old_time);
    database
        .run_command(doc! { "collMod": "rushees", "validator": {} })
        .await
        .unwrap();
}
