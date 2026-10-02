use axum::{extract::Path, Json};
use bson::{doc, DateTime};
use serde_json::json;

use super::*;

pub(super) async fn check_attendance_write_failure() {
    reset().await;
    register().await;
    db::get_rush_nights_collection()
        .await
        .insert_one(RushNight {
            name: "Night 1".to_string(),
            time: DateTime::from_millis(DateTime::now().timestamp_millis() - 3_600_000),
        })
        .await
        .unwrap();

    let database = db::get_mongo_client().await.database("rush-app");
    // Reject the attendance update to pin the response and unchanged record.
    database
        .run_command(doc! {
            "collMod": "rushees",
            "validator": { "attendance": { "$size": 0 } }
        })
        .await
        .unwrap();
    assert_eq!(
        rushee::update_attendance(path()).await.unwrap().0,
        json!({"status": "error", "message": "couldn't update rushee attendance"})
    );
    assert!(stored_rushee().await.attendance.is_empty());
    database
        .run_command(doc! { "collMod": "rushees", "validator": {} })
        .await
        .unwrap();
}

pub(super) async fn check_profile_write_failures() {
    reset().await;
    register().await;
    let database = db::get_mongo_client().await.database("rush-app");

    // Reject the second edit so the earlier write remains visible in the record.
    database
        .run_command(doc! {
            "collMod": "rushees",
            "validator": { "housing": "Campus" }
        })
        .await
        .unwrap();
    let edits = json!([
        {"field": "major", "new_value": "Finance"},
        {"field": "housing", "new_value": "Off Campus"}
    ]);
    let response = rushee::update_rushee(path(), Json(serde_json::from_value(edits).unwrap()))
        .await
        .unwrap()
        .0;
    assert_eq!(
        response,
        json!({"status": "error", "message": "Some error occurred when updating the rushee"})
    );
    let stored = stored_rushee().await;
    assert_eq!(stored.major, "Finance");
    assert_eq!(stored.housing, "Campus");
    database
        .run_command(doc! { "collMod": "rushees", "validator": {} })
        .await
        .unwrap();

    reset().await;
    register().await;
    // A rejected synced name must leave both profile and PIS signup names unchanged.
    database
        .run_command(doc! {
            "collMod": "rushees",
            "validator": { "first_name": "Test" }
        })
        .await
        .unwrap();
    let edits = json!([
        {"field": "major", "new_value": "Finance"},
        {"field": "first_name", "new_value": "Changed"}
    ]);
    let response = rushee::update_rushee(path(), Json(serde_json::from_value(edits).unwrap()))
        .await
        .unwrap()
        .0;
    assert_eq!(response["status"], "error");
    assert!(response["message"]
        .as_str()
        .unwrap()
        .contains("Document failed validation"));
    let stored = stored_rushee().await;
    assert_eq!(stored.major, "Finance");
    assert_eq!(stored.first_name, "Test");
    assert_eq!(stored.pis_signup.rushee_first_name, "Test");
    database
        .run_command(doc! { "collMod": "rushees", "validator": {} })
        .await
        .unwrap();
}

pub(super) async fn check_cloud_write_failure() {
    reset().await;
    let database = db::get_mongo_client().await.database("rush-app");
    let collection = database.collection::<bson::Document>("rushees");
    collection
        .insert_one(doc! {"_id": "legacy-id", "cloud": "original"})
        .await
        .unwrap();

    // Reject a matched cloud update; a no-match update reports success instead.
    database
        .run_command(doc! {
            "collMod": "rushees",
            "validator": {"cloud": "original"}
        })
        .await
        .unwrap();
    assert_eq!(
        rushee::update_cloud(Path("legacy-id".to_string()), Json("changed".to_string()))
            .await
            .unwrap()
            .0,
        json!({"status": "error", "message": "did not update cloud"})
    );
    assert_eq!(
        collection
            .find_one(doc! {"_id": "legacy-id"})
            .await
            .unwrap()
            .unwrap()
            .get_str("cloud")
            .unwrap(),
        "original"
    );
    database
        .run_command(doc! {"collMod": "rushees", "validator": {}})
        .await
        .unwrap();
}
