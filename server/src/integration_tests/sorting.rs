use axum::{Extension, Json};
use serde_json::json;

use super::fixtures::*;
use crate::{
    controllers::{admin, db, rushee},
    middlewares::auth::FirebaseUser,
};

fn brother() -> Extension<FirebaseUser> {
    Extension(FirebaseUser {
        uid: "brother-1".to_string(),
        email: Some("brother@example.invalid".to_string()),
        is_admin: true,
        is_bidcom: false,
    })
}

pub async fn check_contracts() {
    reset().await;
    register().await;
    let original = stored_rushee().await;
    let invalid = admin::update_rushee_sorting(
        path(),
        brother(),
        Json(
            serde_json::from_value(json!({
                "sortingStatus": "unknown", "sortingOrder": 4
            }))
            .unwrap(),
        ),
    )
    .await
    .unwrap()
    .0;
    assert_eq!(invalid["status"], "error");
    assert_eq!(
        stored_rushee().await.sorting_status,
        original.sorting_status
    );

    let valid = admin::update_rushee_sorting(
        path(),
        brother(),
        Json(
            serde_json::from_value(json!({
                "sortingStatus": "IN_CLOUD", "sortingOrder": 4
            }))
            .unwrap(),
        ),
    )
    .await
    .unwrap()
    .0;
    assert_eq!(valid["status"], "success");
    assert_eq!(stored_rushee().await.sorting_status, "IN_CLOUD");
    assert_eq!(stored_rushee().await.sorting_order, 4);

    let response = admin::update_rushee_notes(
        path(),
        brother(),
        Json(
            serde_json::from_value(json!({
                "sortingNotes": "Committee observation", "sortingTags": ["pis", "unknown", "pis"]
            }))
            .unwrap(),
        ),
    )
    .await
    .unwrap()
    .0;
    assert_eq!(response["status"], "success");
    let stored = stored_rushee().await;
    assert_eq!(stored.sorting_tags, ["pis", "pis"]);
    assert_eq!(
        stored.notes_updated_by.as_deref(),
        Some("brother@example.invalid")
    );
    let notes = admin::get_rushee_notes(path()).await.unwrap().0;
    assert_eq!(notes["sortingNotes"], "Committee observation");
    assert_eq!(notes["sortingStatus"], "IN_CLOUD");
    println!("sorting status, note tags, and attribution contracts passed");

    check_move_contracts().await;
}

async fn check_move_contracts() {
    reset().await;
    register().await;
    let second_id = "900000002";
    let mut second_payload = signup_payload();
    second_payload["gtid"] = json!(second_id);
    second_payload["email"] = json!("second@example.invalid");
    let registration = rushee::signup(Json(serde_json::from_value(second_payload).unwrap()))
        .await
        .unwrap()
        .0;
    assert_eq!(registration["status"], "success");

    let collection = db::get_rushee_client().await;
    for (id, order) in [(GTID, 1), (second_id, 2)] {
        collection
            .update_one(
                mongodb::bson::doc! { "gtid": id },
                mongodb::bson::doc! { "$set": { "sorting_status": "IN_CLOUD", "sorting_order": order } },
            )
            .await
            .unwrap();
    }

    let same_column = admin::move_rushee(
        brother(),
        Json(
            serde_json::from_value(json!({
                "fromColumn": "IN_CLOUD", "toColumn": "IN_CLOUD",
                "movedRusheeId": GTID, "targetIndex": 1
            }))
            .unwrap(),
        ),
    )
    .await
    .unwrap()
    .0;
    assert_eq!(same_column["status"], "success");
    let first = stored_rushee().await;
    let second = collection
        .find_one(mongodb::bson::doc! { "gtid": second_id })
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        (first.sorting_status.as_str(), first.sorting_order),
        ("IN_CLOUD", 2)
    );
    assert_eq!(
        (second.sorting_status.as_str(), second.sorting_order),
        ("IN_CLOUD", 1)
    );
    assert_eq!(
        first.status_updated_by.as_deref(),
        Some("brother@example.invalid")
    );

    let cross_column = admin::move_rushee(
        brother(),
        Json(
            serde_json::from_value(json!({
                "fromColumn": "IN_CLOUD", "toColumn": "MID_CLOUD",
                "movedRusheeId": GTID, "targetIndex": -1
            }))
            .unwrap(),
        ),
    )
    .await
    .unwrap()
    .0;
    assert_eq!(cross_column["status"], "success");
    let first = stored_rushee().await;
    let second = collection
        .find_one(mongodb::bson::doc! { "gtid": second_id })
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        (first.sorting_status.as_str(), first.sorting_order),
        ("MID_CLOUD", 1)
    );
    assert_eq!(
        (second.sorting_status.as_str(), second.sorting_order),
        ("IN_CLOUD", 1)
    );
    println!("same-column and cross-column move contracts passed");
}
