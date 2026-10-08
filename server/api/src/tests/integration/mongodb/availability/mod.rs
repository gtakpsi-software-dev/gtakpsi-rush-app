use axum::Json;
use bson::doc;
use serde_json::json;

use super::fixtures::{reset, SLOT};
use crate::{controllers::admin, models::pis::IncomingBrotherAvailability, storage::db};

mod failure_cases;

// Check whether the standard test brother still needs to submit availability.
async fn needs_form() -> serde_json::Value {
    admin::check_brother_needs_availability_form(Json(
        serde_json::from_value(json!({"brother_uid": "brother-1"})).unwrap(),
    ))
    .await
    .unwrap()
    .0
}

// Verify form activation, submission replacement, reset, and deactivation behavior.
pub async fn check_contracts() {
    reset().await;

    assert_eq!(
        admin::get_pis_availability_form_status().await.unwrap().0,
        json!({"status": "success", "is_active": false, "sent_at": null})
    );
    assert_eq!(
        needs_form().await,
        json!({"status": "success", "needs_form": false})
    );

    assert_eq!(
        admin::send_pis_availability_form().await.unwrap().0,
        json!({"status": "success", "message": "PIS availability form sent to all brothers"})
    );
    let active = admin::get_pis_availability_form_status().await.unwrap().0;
    assert_eq!(active["status"], "success");
    assert_eq!(active["is_active"], true);
    assert!(!active["sent_at"].is_null());
    assert_eq!(
        needs_form().await,
        json!({"status": "success", "needs_form": true})
    );

    // A malformed earlier submission must not hide a later valid brother.
    let availability_collection = db::get_mongo_client()
        .await
        .database("rush-app")
        .collection::<bson::Document>("brother-pis-availability");
    availability_collection
        .insert_one(doc! {"brother_uid": "malformed"})
        .await
        .unwrap();

    for first in ["Ada", "Grace"] {
        let payload = IncomingBrotherAvailability {
            brother_uid: "brother-1".to_string(),
            brother_email: "brother@example.invalid".to_string(),
            brother_first_name: first.to_string(),
            brother_last_name: "Hopper".to_string(),
            available_timeslots: vec![SLOT.to_string()],
        };
        assert_eq!(
            admin::submit_brother_availability(Json(payload))
                .await
                .unwrap()
                .0,
            json!({"status": "success", "message": "Availability submitted successfully"})
        );
    }
    assert_eq!(
        needs_form().await,
        json!({"status": "success", "needs_form": false})
    );
    let submissions = admin::get_all_brother_availabilities().await.unwrap().0;
    assert_eq!(submissions["status"], "success");
    assert_eq!(
        availability_collection
            .count_documents(doc! {})
            .await
            .unwrap(),
        2
    );
    assert_eq!(submissions["payload"].as_array().unwrap().len(), 1);
    assert_eq!(submissions["payload"][0]["brother_first_name"], "Grace");
    assert_eq!(submissions["payload"][0]["brother_uid"], "brother-1");
    assert_eq!(
        submissions["payload"][0]["available_timeslots"]
            .as_array()
            .unwrap()
            .len(),
        1
    );

    assert_eq!(
        admin::clear_and_resend_pis_availability_form()
            .await
            .unwrap()
            .0,
        json!({"status": "success", "message": "Cleared all submissions and resent form"})
    );
    assert_eq!(
        needs_form().await,
        json!({"status": "success", "needs_form": true})
    );
    assert!(
        admin::get_all_brother_availabilities().await.unwrap().0["payload"]
            .as_array()
            .unwrap()
            .is_empty()
    );

    assert_eq!(
        admin::deactivate_pis_availability_form().await.unwrap().0,
        json!({"status": "success", "message": "Form deactivated"})
    );
    let inactive = admin::get_pis_availability_form_status().await.unwrap().0;
    assert_eq!(inactive["is_active"], false);
    assert!(!inactive["sent_at"].is_null());
    assert_eq!(
        needs_form().await,
        json!({"status": "success", "needs_form": false})
    );
    failure_cases::check_contracts().await;
    println!("PIS availability lifecycle and submission contracts passed");
}
