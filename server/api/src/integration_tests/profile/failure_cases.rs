use bson::{doc, DateTime};
use serde_json::json;

use super::*;

pub(super) async fn check_attendance_write_failure() {
    reset().await;
    register().await;
    db::get_rush_nights_client()
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
