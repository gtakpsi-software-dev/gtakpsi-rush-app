use axum::Json;
use bson::{doc, DateTime};
use serde_json::json;

use super::fixtures::{capacity, reset, SLOT};
use crate::{
    controllers::{admin, rushee},
    models::pis::PISTimeslotIncoming,
    storage::db,
};

// Build a capacity-change request for the standard fixture timeslot.
fn change(amount: i32) -> Json<PISTimeslotIncoming> {
    Json(PISTimeslotIncoming {
        time: SLOT.to_string(),
        change: amount,
    })
}

// Verify timeslot creation, legacy timestamp matching, and strict listing behavior.
pub async fn check_contracts() {
    reset().await;

    assert_eq!(
        admin::get_pis_timeslots().await.unwrap().0,
        json!({"status": "success", "payload": []})
    );
    assert_eq!(
        admin::add_pis_timeslot(change(2)).await.unwrap().0,
        json!({"status": "success", "message": "successfully created new pis timeslot"})
    );
    assert_eq!(capacity(SLOT).await, 2);

    // The existing-slot update matches the incoming string against a BSON date.
    // Preserve the successful response and unchanged count until behavior changes are authorized.
    assert_eq!(
        admin::add_pis_timeslot(change(3)).await.unwrap().0,
        json!({"status": "success", "message": "added to num_available timeslots"})
    );
    assert_eq!(capacity(SLOT).await, 2);

    assert_eq!(
        admin::delete_pis_timeslot(change(1)).await.unwrap().0,
        json!({"status": "error", "message": "pis timeslot doesn't exist"})
    );
    assert_eq!(capacity(SLOT).await, 2);
    let listed = admin::get_pis_timeslots().await.unwrap().0;
    assert_eq!(listed["status"], "success");
    assert_eq!(listed["payload"].as_array().unwrap().len(), 1);
    assert_eq!(listed["payload"][0]["num_available"], 2);
    let available = rushee::get_available_timeslots().await.unwrap().0;
    assert_eq!(available["status"], "success");
    assert_eq!(available["payload"].as_array().unwrap().len(), 1);
    assert_eq!(available["payload"][0]["capacity"], 2);

    // A malformed row rejects the whole typed listing rather than returning the valid slot.
    let raw_collection = db::get_mongo_client()
        .await
        .database("rush-app")
        .collection::<bson::Document>("pis-timeslots");
    let malformed = raw_collection
        .insert_one(doc! {"time": "invalid", "num_available": 1})
        .await
        .unwrap();
    assert_eq!(
        admin::get_pis_timeslots().await.unwrap().0,
        json!({"status": "error", "message": "some error occurred"})
    );
    assert_eq!(
        rushee::get_available_timeslots().await.unwrap().0,
        json!({"status": "error", "message": "Error reading timeslot data"})
    );
    raw_collection
        .delete_one(doc! {"_id": malformed.inserted_id})
        .await
        .unwrap();

    check_malformed_existing_slot().await;
    check_rejected_creation().await;
    check_delete_lookup_error().await;
    println!("PIS timeslot create, update, delete, and list contracts passed");
}

// Verify that an undecodable existing slot prevents either creation or capacity updates.
async fn check_malformed_existing_slot() {
    reset().await;
    let collection = db::get_mongo_client()
        .await
        .database("rush-app")
        .collection::<bson::Document>("pis-timeslots");
    let time = DateTime::parse_rfc3339_str(SLOT).unwrap();
    collection.insert_one(doc! {"time": time}).await.unwrap();

    // A matching row that cannot decode must stop before either write path.
    assert_eq!(
        admin::add_pis_timeslot(change(3)).await.unwrap().0,
        json!({"status": "error", "message": "some error occurred"})
    );
    assert_eq!(collection.count_documents(doc! {}).await.unwrap(), 1);
    let stored = collection.find_one(doc! {}).await.unwrap().unwrap();
    assert_eq!(stored.get("time"), Some(&bson::Bson::DateTime(time)));
    assert!(!stored.contains_key("num_available"));
}

// Verify that a rejected timeslot insert leaves no stored slot.
async fn check_rejected_creation() {
    reset().await;
    let database = db::get_mongo_client().await.database("rush-app");
    // Reject the insert through MongoDB validation to pin the existing error response.
    database
        .run_command(doc! {
            "collMod": "pis-timeslots",
            "validator": { "num_available": 2 }
        })
        .await
        .unwrap();
    assert_eq!(
        admin::add_pis_timeslot(change(3)).await.unwrap().0,
        json!({"status": "error", "message": "some error occurred while creating the PIS timeslot"})
    );
    assert_eq!(
        db::get_pis_timeslots_collection()
            .await
            .count_documents(doc! {})
            .await
            .unwrap(),
        0
    );
    database
        .run_command(doc! { "collMod": "pis-timeslots", "validator": {} })
        .await
        .unwrap();
}

// Verify that a matching string timestamp produces a decoding error without deletion.
async fn check_delete_lookup_error() {
    reset().await;
    let collection = db::get_mongo_client()
        .await
        .database("rush-app")
        .collection::<bson::Document>("pis-timeslots");
    collection
        .insert_one(doc! {"time": SLOT, "num_available": 2})
        .await
        .unwrap();

    // The delete lookup matches this string, but decoding requires a BSON date.
    // Preserve its error response and leave the malformed row untouched.
    assert_eq!(
        admin::delete_pis_timeslot(change(1)).await.unwrap().0,
        json!({"status": "error", "message": "some error occurred"})
    );
    assert_eq!(collection.count_documents(doc! {}).await.unwrap(), 1);
}
