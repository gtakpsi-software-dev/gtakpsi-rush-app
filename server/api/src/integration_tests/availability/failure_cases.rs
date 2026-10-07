use axum::Json;
use bson::doc;
use serde_json::json;

use super::{reset, SLOT};
use crate::{controllers::admin, models::pis::IncomingBrotherAvailability, storage::db};

mod submission_clear;

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
    let form_collection = db::get_pis_availability_form_status_collection().await;
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
        db::get_brother_pis_availability_collection()
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

    check_rejected_form_send().await;
    submission_clear::check_rejected_submission_clear().await;
    check_rejected_deactivation().await;
    check_rejected_submission_replacement().await;
}

async fn check_rejected_form_send() {
    reset().await;
    assert_eq!(
        admin::send_pis_availability_form().await.unwrap().0["status"],
        "success"
    );

    let collection = db::get_pis_availability_form_status_collection().await;
    let database = db::get_mongo_client().await.database("rush-app");
    // Reject the replacement insert after the previous form has been removed.
    database
        .run_command(doc! {
            "collMod": "pis-availability-form-status",
            "validator": { "is_active": false }
        })
        .await
        .unwrap();
    assert_eq!(
        admin::send_pis_availability_form().await.unwrap().0,
        json!({"status": "error", "message": "Failed to send form"})
    );
    assert_eq!(collection.count_documents(doc! {}).await.unwrap(), 0);
    assert_eq!(
        admin::get_pis_availability_form_status().await.unwrap().0,
        json!({"status": "success", "is_active": false, "sent_at": null})
    );
    database
        .run_command(doc! { "collMod": "pis-availability-form-status", "validator": {} })
        .await
        .unwrap();
}

async fn check_rejected_deactivation() {
    reset().await;
    assert_eq!(
        admin::send_pis_availability_form().await.unwrap().0["status"],
        "success"
    );

    let database = db::get_mongo_client().await.database("rush-app");
    // Reject the inactive replacement so the form remains open after a failed update.
    database
        .run_command(doc! {
            "collMod": "pis-availability-form-status",
            "validator": { "is_active": true }
        })
        .await
        .unwrap();
    assert_eq!(
        admin::deactivate_pis_availability_form().await.unwrap().0,
        json!({"status": "error", "message": "Failed to deactivate form"})
    );
    let current = admin::get_pis_availability_form_status().await.unwrap().0;
    assert_eq!(current["status"], "success");
    assert_eq!(current["is_active"], true);
    assert!(!current["sent_at"].is_null());
    database
        .run_command(doc! { "collMod": "pis-availability-form-status", "validator": {} })
        .await
        .unwrap();
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

    let collection = db::get_brother_pis_availability_collection().await;
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
