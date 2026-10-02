use super::super::fixtures::*;
use super::brother;
use crate::controllers::{admin, db, rushee};
use axum::Json;
use serde_json::json;

pub(super) async fn check_move_contracts() {
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

    let database = db::get_mongo_client().await.database("rush-app");
    // Reject the second order write after the moved card has entered its target column.
    database
        .run_command(mongodb::bson::doc! {
            "collMod": "rushees", "validator": { "gtid": { "$ne": second_id } }
        })
        .await
        .unwrap();
    let partial_move = admin::move_rushee(
        brother(),
        Json(
            serde_json::from_value(json!({
                "fromColumn": "MID_CLOUD", "toColumn": "IN_CLOUD",
                "movedRusheeId": GTID, "targetIndex": 0
            }))
            .unwrap(),
        ),
    )
    .await
    .unwrap()
    .0;
    assert_eq!(
        partial_move,
        json!({"status": "error", "message": "Failed to move rushee"})
    );
    let first = stored_rushee().await;
    let second = collection
        .find_one(mongodb::bson::doc! { "gtid": second_id })
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        (first.sorting_status.as_str(), first.sorting_order),
        ("IN_CLOUD", 1)
    );
    assert_eq!(
        (second.sorting_status.as_str(), second.sorting_order),
        ("IN_CLOUD", 1)
    );
    database
        .run_command(mongodb::bson::doc! { "collMod": "rushees", "validator": {} })
        .await
        .unwrap();
    println!("same-column and cross-column move contracts passed");
}
