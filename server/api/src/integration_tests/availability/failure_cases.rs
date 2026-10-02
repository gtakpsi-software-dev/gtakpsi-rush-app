use axum::Json;
use bson::doc;
use serde_json::json;

use super::{reset, SLOT};
use crate::{controllers::admin, models::pis::IncomingBrotherAvailability, storage::db};

pub(super) async fn check_contracts() {
    let submission = IncomingBrotherAvailability {
        brother_uid: "brother-2".to_string(),
        brother_email: "brother2@example.invalid".to_string(),
        brother_first_name: "Katherine".to_string(),
        brother_last_name: "Johnson".to_string(),
        available_timeslots: vec![SLOT.to_string()],
    };
    assert_eq!(
        admin::submit_brother_availability(Json(submission))
            .await
            .unwrap()
            .0["status"],
        "success"
    );
    let form_collection = db::get_pis_availability_form_status_client().await;
    assert_eq!(form_collection.count_documents(doc! {}).await.unwrap(), 1);

    // Reject the new form record after submission and old-status deletion.
    let database = db::get_mongo_client().await.database("rush-app");
    database
        .run_command(doc! {
            "collMod": "pis-availability-form-status",
            "validator": { "$jsonSchema": {
                "bsonType": "object",
                "properties": { "is_active": { "enum": [false] } }
            } }
        })
        .await
        .unwrap();
    assert_eq!(
        admin::clear_and_resend_pis_availability_form()
            .await
            .unwrap()
            .0,
        json!({"status": "error", "message": "Failed to resend form"})
    );
    assert_eq!(
        db::get_brother_pis_availability_client()
            .await
            .count_documents(doc! {})
            .await
            .unwrap(),
        0
    );
    assert_eq!(form_collection.count_documents(doc! {}).await.unwrap(), 0);
    assert_eq!(
        admin::get_pis_availability_form_status().await.unwrap().0,
        json!({"status": "success", "is_active": false, "sent_at": null})
    );
    database
        .run_command(doc! { "collMod": "pis-availability-form-status", "validator": {} })
        .await
        .unwrap();

    check_rejected_submission_replacement().await;
}

async fn check_rejected_submission_replacement() {
    reset().await;
    let existing = IncomingBrotherAvailability {
        brother_uid: "brother-2".to_string(),
        brother_email: "brother2@example.invalid".to_string(),
        brother_first_name: "Katherine".to_string(),
        brother_last_name: "Johnson".to_string(),
        available_timeslots: vec![SLOT.to_string()],
    };
    assert_eq!(
        admin::submit_brother_availability(Json(existing))
            .await
            .unwrap()
            .0["status"],
        "success"
    );

    let collection = db::get_brother_pis_availability_client().await;
    let database = db::get_mongo_client().await.database("rush-app");
    // Reject the replacement insert to pin the existing delete-then-insert outcome.
    database
        .run_command(doc! {
            "collMod": "brother-pis-availability",
            "validator": { "brother_first_name": "Katherine" }
        })
        .await
        .unwrap();
    let replacement = IncomingBrotherAvailability {
        brother_uid: "brother-2".to_string(),
        brother_email: "brother2@example.invalid".to_string(),
        brother_first_name: "Changed".to_string(),
        brother_last_name: "Johnson".to_string(),
        available_timeslots: vec![SLOT.to_string()],
    };
    assert_eq!(
        admin::submit_brother_availability(Json(replacement))
            .await
            .unwrap()
            .0,
        json!({"status": "error", "message": "Failed to submit availability"})
    );
    assert_eq!(collection.count_documents(doc! {}).await.unwrap(), 0);
    database
        .run_command(doc! { "collMod": "brother-pis-availability", "validator": {} })
        .await
        .unwrap();
}
