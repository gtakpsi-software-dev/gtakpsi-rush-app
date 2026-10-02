use axum::Json;
use bson::doc;
use serde_json::json;

use super::fixtures::{capacity, reset, SLOT};
use crate::{controllers::admin, models::pis::PISTimeslotIncoming, storage::db};

fn change(amount: i32) -> Json<PISTimeslotIncoming> {
    Json(PISTimeslotIncoming {
        time: SLOT.to_string(),
        change: amount,
    })
}

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

    check_rejected_creation().await;
    println!("PIS timeslot create, update, delete, and list contracts passed");
}

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
        db::get_pis_timeslots_client()
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
