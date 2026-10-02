mod failure_cases;
mod moves;

use axum::{Extension, Json};
use serde_json::json;

use super::fixtures::*;
use crate::{controllers::admin, middlewares::auth::FirebaseUser};

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
    let admin_list = admin::get_sorting_rushees().await.unwrap().0;
    let public_list = admin::get_sorting_rushees_public().await.unwrap().0;
    assert_eq!(admin_list["payload"][0]["sortingStatus"], "IN_CLOUD");
    assert_eq!(admin_list["payload"][0]["sortingOrder"], 4);
    assert_eq!(admin_list["payload"][0]["rushNumber"], 1);
    assert_eq!(public_list["payload"][0]["rushNumber"], 0);
    println!("sorting status, note tags, and attribution contracts passed");

    moves::check_move_contracts().await;
    failure_cases::check_single_sorting_write_failure().await;
    failure_cases::check_bulk_reorder_failure().await;
}
