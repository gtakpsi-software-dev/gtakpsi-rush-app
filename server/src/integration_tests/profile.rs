use axum::{extract::Path, Json};
use bson::DateTime;
use serde_json::json;

use super::fixtures::*;
use crate::{
    controllers::{db, rushee},
    models::misc::RushNight,
};

pub async fn check_contracts() {
    reset().await;
    register().await;
    assert_eq!(
        rushee::update_attendance(path()).await.unwrap().0["message"],
        "no rush nights are configured"
    );
    db::get_rush_nights_client()
        .await
        .insert_one(RushNight {
            name: "Night 1".to_string(),
            time: DateTime::from_millis(DateTime::now().timestamp_millis() - 3_600_000),
        })
        .await
        .unwrap();
    for _ in 0..2 {
        assert_eq!(
            rushee::update_attendance(path()).await.unwrap().0["status"],
            "success"
        );
    }
    assert_eq!(stored_rushee().await.attendance.len(), 1);

    let edits = json!([{"field": "first_name", "new_value": "Updated"}]);
    assert_eq!(
        rushee::update_rushee(path(), Json(serde_json::from_value(edits).unwrap()))
            .await
            .unwrap()
            .0["status"],
        "success"
    );
    let stored = stored_rushee().await;
    assert_eq!(stored.first_name, "Updated");
    assert_eq!(stored.pis_signup.rushee_first_name, "Updated");

    let partial_edits = json!([
        {"field": "major", "new_value": "Finance"},
        {"field": "access_code", "new_value": "invalid edit"}
    ]);
    let failed =
        rushee::update_rushee(path(), Json(serde_json::from_value(partial_edits).unwrap()))
            .await
            .unwrap()
            .0;
    assert_eq!(
        failed["message"],
        "Invalid rushee field passed in: access_code"
    );
    assert_eq!(stored_rushee().await.major, "Finance");
    assert_ne!(stored_rushee().await.access_code, "invalid edit");

    let list = rushee::get_rushees().await.unwrap().0;
    assert_eq!(list["payload"].as_array().unwrap().len(), 1);
    assert_eq!(list["payload"][0]["name"], "Updated Rushee");
    assert_eq!(list["payload"][0]["registration_order"], 1);
    assert!(list["payload"][0].get("access_code").is_none());
    assert!(list["payload"][0].get("comments").is_none());
    let nights = list["payload"][0]["interactions_by_night"]
        .as_array()
        .unwrap();
    let attended = nights
        .iter()
        .find(|night| night["name"] == "Night 1")
        .unwrap();
    assert_eq!(attended["interactions"], 0);
    assert_eq!(
        rushee::does_rushee_exist(path()).await.unwrap().0,
        json!({"status": "error", "message": "exists"})
    );
    let detail = rushee::get_rushee(path()).await.unwrap().0;
    assert_eq!(detail["payload"]["first_name"], "Updated");
    assert_eq!(detail["payload"]["comments"], json!([]));
    assert_eq!(
        rushee::get_rushee(Path("missing-rushee".to_string()))
            .await
            .unwrap()
            .0["message"],
        "Rushee with GTID missing-rushee does not exist"
    );
    assert_eq!(
        rushee::does_rushee_exist(Path("missing-rushee".to_string()))
            .await
            .unwrap()
            .0,
        json!({
            "status": "success",
            "message": "Rushee with GTID missing-rushee does not exist"
        })
    );
    println!(
        "attendance, profile edits, partial-write ordering, and rushee lookup contracts passed"
    );
}
