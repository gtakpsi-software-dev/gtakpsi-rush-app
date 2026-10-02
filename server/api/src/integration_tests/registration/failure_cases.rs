use axum::Json;
use bson::{doc, DateTime};
use serde_json::json;

use super::super::fixtures::{add_slot, capacity, path, signup_payload, stored_rushee, GTID, SLOT};
use crate::{controllers::rushee, storage::db};

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

pub(super) async fn check_signup_insert_failure() {
    let new_gtid = "900000002";
    let before = capacity(SLOT).await;
    let database = db::get_mongo_client().await.database("rush-app");

    // Reject only the new rushee document after signup reserves a PIS slot.
    database
        .run_command(doc! {
            "collMod": "rushees",
            "validator": { "$jsonSchema": {
                "bsonType": "object",
                "properties": { "gtid": { "enum": [GTID] } }
            } }
        })
        .await
        .unwrap();
    let mut payload = signup_payload();
    payload["gtid"] = json!(new_gtid);
    assert_eq!(
        rushee::signup(Json(serde_json::from_value(payload).unwrap()))
            .await
            .unwrap()
            .0,
        json!({"status": "error", "message": "there was some error"})
    );
    assert_eq!(capacity(SLOT).await, before - 1);
    assert_eq!(
        db::get_rushee_client()
            .await
            .count_documents(doc! {"gtid": new_gtid})
            .await
            .unwrap(),
        0
    );
    database
        .run_command(doc! { "collMod": "rushees", "validator": {} })
        .await
        .unwrap();
}

pub(super) async fn check_reschedule_missing_rushee_and_old_slot(old_slot: &str) {
    let new_slot = "2030-01-05T18:00:00Z";
    add_slot(new_slot, 1).await;
    let old_capacity = capacity(old_slot).await;

    let missing = rushee::reschedule_pis(
        axum::extract::Path("not-registered".to_string()),
        Json(new_slot.to_string()),
    )
    .await
    .unwrap()
    .0;
    assert_eq!(
        missing,
        json!({"status": "error", "message": "Rushee not found"})
    );
    assert_eq!(capacity(old_slot).await, old_capacity);
    assert_eq!(capacity(new_slot).await, 1);

    // Removing the old slot isolates the release failure before the new slot can be claimed.
    db::get_pis_timeslots_client()
        .await
        .delete_one(bson::doc! {"time": DateTime::parse_rfc3339_str(old_slot).unwrap()})
        .await
        .unwrap();
    let failed = rushee::reschedule_pis(path(), Json(new_slot.to_string()))
        .await
        .unwrap()
        .0;
    assert_eq!(
        failed,
        json!({"status": "error", "message": "Failed to vacate old timeslot: PIS timeslot does not exist"})
    );
    assert_eq!(capacity(new_slot).await, 1);
    let stored = stored_rushee().await;
    assert_eq!(
        stored.pis_timeslot,
        DateTime::parse_rfc3339_str(old_slot).unwrap()
    );
    assert_eq!(stored.pis_signup.time, stored.pis_timeslot);
}
