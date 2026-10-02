use axum::Json;
use bson::doc;
use serde_json::json;

use super::*;
use crate::{controllers::rushee, storage::db};

pub(super) async fn check_bulk_reorder_failure() {
    reset().await;
    register().await;
    let second_id = "900000002";
    let mut second_payload = signup_payload();
    second_payload["gtid"] = json!(second_id);
    second_payload["email"] = json!("second@example.invalid");
    assert_eq!(
        rushee::signup(Json(serde_json::from_value(second_payload).unwrap()))
            .await
            .unwrap()
            .0["status"],
        "success"
    );

    let collection = db::get_rushee_client().await;
    let second_before = collection
        .find_one(doc! { "gtid": second_id })
        .await
        .unwrap()
        .unwrap();
    let database = db::get_mongo_client().await.database("rush-app");
    // Fail the second write so the first ordered record remains committed.
    database
        .run_command(doc! {
            "collMod": "rushees",
            "validator": { "gtid": { "$ne": second_id } }
        })
        .await
        .unwrap();
    let payload = json!({
        "column": "MID_CLOUD", "orderedRusheeIds": [GTID, second_id]
    });
    let response = admin::bulk_reorder(brother(), Json(serde_json::from_value(payload).unwrap()))
        .await
        .unwrap()
        .0;
    assert_eq!(
        response,
        json!({"status": "error", "message": "Failed to reorder"})
    );

    let first = stored_rushee().await;
    let second = collection
        .find_one(doc! { "gtid": second_id })
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        (first.sorting_status.as_str(), first.sorting_order),
        ("MID_CLOUD", 1)
    );
    assert_eq!(second.sorting_status, second_before.sorting_status);
    assert_eq!(second.sorting_order, second_before.sorting_order);
    database
        .run_command(doc! { "collMod": "rushees", "validator": {} })
        .await
        .unwrap();
}
