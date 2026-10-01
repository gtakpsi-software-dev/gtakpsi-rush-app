use axum::Json;
use bson::DateTime;
use serde_json::json;

use super::fixtures::*;
use crate::{
    controllers::{db, rushee},
    models::{misc::RushNight, rushee::IncomingComment},
};

fn payload(name: &str, value: f32) -> IncomingComment {
    serde_json::from_value(json!({
        "brother_id": name, "brother_name": name, "comment": "Observation",
        "ratings": [{"name": "Professionalism", "value": value}]
    }))
    .unwrap()
}

pub async fn check_contracts() {
    reset().await;
    register().await;
    assert_eq!(
        rushee::post_comment(path(), Json(payload("Alex", 0.0)))
            .await
            .unwrap()
            .0["message"],
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
    assert_eq!(
        rushee::post_comment(
            axum::extract::Path("missing-rushee".to_string()),
            Json(payload("Alex", 0.0)),
        )
        .await
        .unwrap()
        .0["message"],
        "some error occurred"
    );
    assert_eq!(
        rushee::post_comment(path(), Json(payload("Alex", 0.0)))
            .await
            .unwrap()
            .0["status"],
        "success"
    );
    assert_eq!(stored_rushee().await.ratings[0].value, 0.0);
    assert_eq!(
        rushee::post_comment(path(), Json(payload("Bailey", 4.0)))
            .await
            .unwrap()
            .0["status"],
        "success"
    );
    assert_eq!(stored_rushee().await.ratings[0].value, 4.0);
    assert_eq!(
        rushee::post_comment(path(), Json(payload("Bailey", 1.0)))
            .await
            .unwrap()
            .0["message"],
        "you have already made a comment for this rush night"
    );
    assert_eq!(stored_rushee().await.comments.len(), 2);

    let mut edited = stored_rushee().await.comments[1].clone();
    edited.comment = "Edited observation".to_string();
    edited.ratings[0].value = 1.0;
    assert_eq!(
        rushee::edit_comment(path(), Json(edited)).await.unwrap().0["status"],
        "success"
    );
    let stored = stored_rushee().await;
    assert_eq!(stored.comments[1].comment, "Edited observation");
    assert_eq!(stored.comments[1].ratings[0].value, 4.0);
    assert_eq!(stored.ratings[0].value, 4.0);
    assert_eq!(
        rushee::delete_comment(path(), Json(stored.comments[1].clone()))
            .await
            .unwrap()
            .0["status"],
        "success"
    );
    let remaining = stored_rushee().await;
    assert_eq!(remaining.comments.len(), 1);
    assert!(remaining.ratings.is_empty());
    println!(
        "comment duplication, legacy ratings, text-only editing, and deletion contracts passed"
    );
}
