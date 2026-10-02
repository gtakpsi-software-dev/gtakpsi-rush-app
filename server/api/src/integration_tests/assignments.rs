use bson::{doc, DateTime};
use serde_json::json;

use super::fixtures::{register, reset, stored_rushee, SLOT};
use crate::{controllers::admin, models::pis::BrotherPISAvailability, storage::db};

mod failure_cases;

async fn add_availability_at(first: &str, last: &str, slot: &str) {
    db::get_brother_pis_availability_client()
        .await
        .insert_one(BrotherPISAvailability {
            brother_uid: format!("{first}-{last}"),
            brother_email: "brother@example.invalid".to_string(),
            brother_first_name: first.to_string(),
            brother_last_name: last.to_string(),
            available_timeslots: vec![DateTime::parse_rfc3339_str(slot).unwrap()],
            submitted_at: DateTime::from_millis(0),
        })
        .await
        .unwrap();
}

async fn add_availability(first: &str, last: &str) {
    add_availability_at(first, last, SLOT).await;
}

pub async fn check_contracts() {
    reset().await;
    register().await;

    assert_eq!(
        admin::auto_assign_pis_brothers().await.unwrap().0,
        json!({
            "status": "error",
            "message": "No brother availabilities found. Have brothers fill out the form first."
        })
    );

    add_availability_at("Unavailable", "Brother", "2030-01-02T18:00:00Z").await;
    assert_eq!(
        admin::auto_assign_pis_brothers().await.unwrap().0,
        json!({
            "status": "success",
            "message": "Assigned brothers to 0 PIS slots. 1 slots could not be fully assigned (all available brothers at that time were busy)."
        })
    );
    let unmatched = stored_rushee().await.pis_signup;
    assert_eq!(unmatched.first_brother_first_name, "none");
    assert_eq!(unmatched.second_brother_first_name, "none");

    add_availability("Ada", "Lovelace").await;
    assert_eq!(
        admin::auto_assign_pis_brothers().await.unwrap().0,
        json!({
            "status": "success",
            "message": "Assigned brothers to 1 PIS slots. 1 slots could not be fully assigned (all available brothers at that time were busy)."
        })
    );
    let partial = stored_rushee().await.pis_signup;
    assert_eq!(partial.first_brother_first_name, "Ada");
    assert_eq!(partial.first_brother_last_name, "Lovelace");
    assert_eq!(partial.second_brother_first_name, "none");

    add_availability("Grace", "Hopper").await;
    assert_eq!(
        admin::auto_assign_pis_brothers().await.unwrap().0,
        json!({
            "status": "success",
            "message": "Assigned brothers to 1 PIS slots. 0 slots could not be fully assigned (all available brothers at that time were busy)."
        })
    );
    let complete = stored_rushee().await.pis_signup;
    assert_eq!(complete.first_brother_first_name, "Ada");
    assert_eq!(complete.second_brother_first_name, "Grace");
    assert_eq!(complete.second_brother_last_name, "Hopper");

    assert_eq!(
        admin::auto_assign_pis_brothers().await.unwrap().0,
        json!({
            "status": "success",
            "message": "Assigned brothers to 0 PIS slots. 0 slots could not be fully assigned (all available brothers at that time were busy)."
        })
    );
    assert_eq!(
        admin::clear_pis_assignments().await.unwrap().0,
        json!({"status": "success", "message": "Cleared assignments from 1 rushees"})
    );
    let cleared = stored_rushee().await.pis_signup;
    assert_eq!(cleared.first_brother_first_name, "none");
    assert_eq!(cleared.first_brother_last_name, "none");
    assert_eq!(cleared.second_brother_first_name, "none");
    assert_eq!(cleared.second_brother_last_name, "none");

    let database = db::get_mongo_client().await.database("rush-app");
    // A rejected assignment write leaves the slot empty; its planned result still drives counts.
    database
        .run_command(doc! {
            "collMod": "rushees",
            "validator": { "pis_signup.first_brother_first_name": "none" }
        })
        .await
        .unwrap();
    assert_eq!(
        admin::auto_assign_pis_brothers().await.unwrap().0,
        json!({
            "status": "success",
            "message": "Assigned brothers to 0 PIS slots. 0 slots could not be fully assigned (all available brothers at that time were busy)."
        })
    );
    let rejected = stored_rushee().await.pis_signup;
    assert_eq!(rejected.first_brother_first_name, "none");
    assert_eq!(rejected.second_brother_first_name, "none");
    database
        .run_command(doc! { "collMod": "rushees", "validator": {} })
        .await
        .unwrap();
    failure_cases::check_clear_failure().await;
    failure_cases::check_malformed_availability_is_skipped().await;
    println!("PIS auto-assignment and clearing contracts passed");
}
