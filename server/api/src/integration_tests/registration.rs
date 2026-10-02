use axum::{extract::Query, Json};
use bson::doc;
use serde_json::json;

use super::fixtures::*;
use crate::{
    controllers::{db, rushee},
    middlewares::valid,
};

mod failure_cases;

pub async fn check_contracts() {
    reset().await;
    assert!(!valid::is_gtid_valid("short").await.unwrap());
    assert!(valid::is_gtid_valid("abcdefghi").await.unwrap());
    assert!(valid::is_gtid_valid(GTID).await.unwrap());
    let unavailable = rushee::signup(Json(serde_json::from_value(signup_payload()).unwrap()))
        .await
        .unwrap()
        .0;
    assert_eq!(unavailable["message"], "PIS timeslot does not exist");
    assert_eq!(
        db::get_rushee_client()
            .await
            .count_documents(doc! {})
            .await
            .unwrap(),
        0
    );

    let code = register().await;
    assert_eq!(code.len(), 15);
    assert!(code.chars().all(|c| c.is_ascii_alphanumeric()));
    let registered = stored_rushee().await;
    assert!(!valid::is_gtid_valid(GTID).await.unwrap());
    assert_eq!(registered.access_code, code);
    assert_eq!(registered.pis_signup.rushee_gtid, GTID);
    assert_eq!(registered.pis_signup.rushee_first_name, "Test");
    assert_eq!(registered.pis_signup.time, registered.pis_timeslot);
    assert_eq!(registered.cloud, "none");
    assert_eq!(registered.sorting_status, "UNSORTED");
    assert!(registered.pis.is_empty());
    assert!(registered.comments.is_empty());
    assert!(registered.ratings.is_empty());
    assert_eq!(capacity(SLOT).await, 1);
    let duplicate = rushee::signup(Json(serde_json::from_value(signup_payload()).unwrap()))
        .await
        .unwrap()
        .0;
    assert_eq!(
        duplicate["message"],
        "gtid either already exists or is not 9 digits"
    );
    assert_eq!(capacity(SLOT).await, 1);

    for supplied in [json!({}), json!({"code": "wrong"}), json!({"code": ""})] {
        let response =
            rushee::get_rushee_self(path(), Query(serde_json::from_value(supplied).unwrap()))
                .await
                .unwrap()
                .0;
        assert_eq!(
            response,
            json!({"status": "error", "message": "Invalid access code"})
        );
    }
    let response = rushee::get_rushee_self(
        path(),
        Query(serde_json::from_value(json!({"code": code})).unwrap()),
    )
    .await
    .unwrap()
    .0;
    assert_eq!(response["status"], "success");
    assert_eq!(response["payload"].as_object().unwrap().len(), 12);
    for field in [
        "comments",
        "ratings",
        "sorting_notes",
        "sorting_status",
        "access_code",
        "pis",
    ] {
        assert!(response["payload"].get(field).is_none());
    }

    let new_slot = "2030-01-02T18:00:00Z";
    add_slot(new_slot, 0).await;
    let failed = rushee::reschedule_pis(path(), Json(new_slot.to_string()))
        .await
        .unwrap()
        .0;
    assert_eq!(
        failed["message"],
        "Failed to take new timeslot: All slots for this time are taken"
    );
    assert_eq!(capacity(SLOT).await, 1);
    let successful_slot = "2030-01-03T18:00:00Z";
    add_slot(successful_slot, 1).await;
    assert_eq!(
        rushee::reschedule_pis(path(), Json(successful_slot.to_string()))
            .await
            .unwrap()
            .0["status"],
        "success"
    );
    assert_eq!(capacity(SLOT).await, 2);
    assert_eq!(capacity(successful_slot).await, 0);
    let stored = stored_rushee().await;
    assert_eq!(stored.pis_timeslot, stored.pis_signup.time);
    assert_eq!(
        stored.pis_timeslot,
        bson::DateTime::parse_rfc3339_str(successful_slot).unwrap()
    );
    failure_cases::check_reschedule_write_failure(successful_slot).await;
    println!("registration, self-service privacy, and rescheduling contracts passed");
}
