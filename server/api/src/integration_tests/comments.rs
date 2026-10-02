use axum::Json;
use bson::{doc, DateTime};
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

    let mut unmatched = stored_rushee().await.comments[1].clone();
    unmatched.brother_name = "Nobody".to_string();
    unmatched.comment = "Should not appear".to_string();
    assert_eq!(
        rushee::edit_comment(path(), Json(unmatched))
            .await
            .unwrap()
            .0["status"],
        "success"
    );
    assert_eq!(stored_rushee().await.comments[1].comment, "Observation");

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
        rushee::delete_comment(
            axum::extract::Path("missing-rushee".to_string()),
            Json(stored.comments[1].clone()),
        )
        .await
        .unwrap()
        .0["message"],
        "rushee not found"
    );

    let mut unmatched_delete = stored.comments[1].clone();
    unmatched_delete.brother_name = "Nobody".to_string();
    assert_eq!(
        rushee::delete_comment(path(), Json(unmatched_delete))
            .await
            .unwrap()
            .0["status"],
        "success"
    );
    assert_eq!(stored_rushee().await.comments.len(), 2);
    assert_eq!(stored_rushee().await.ratings[0].value, 4.0);

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

    let database = db::get_mongo_client().await.database("rush-app");
    // Reject only the comment append so the earlier rating write remains observable.
    database
        .run_command(doc! {
            "collMod": "rushees",
            "validator": { "$jsonSchema": {
                "bsonType": "object",
                "properties": { "comments": { "bsonType": "array", "maxItems": 1 } }
            } }
        })
        .await
        .unwrap();
    let failed_append = rushee::post_comment(path(), Json(payload("Cameron", 2.0)))
        .await
        .unwrap()
        .0;
    assert_eq!(
        failed_append,
        json!({"status": "error", "message": "something wrong occurred"})
    );
    let partial = stored_rushee().await;
    assert_eq!(partial.comments.len(), 1);
    assert_eq!(partial.ratings[0].value, 2.0);
    database
        .run_command(doc! { "collMod": "rushees", "validator": {} })
        .await
        .unwrap();

    // A rejected rating update must stop before the comment append.
    database
        .run_command(doc! {
            "collMod": "rushees",
            "validator": { "$jsonSchema": {
                "bsonType": "object",
                "properties": { "ratings": { "bsonType": "array", "maxItems": 1 } }
            } }
        })
        .await
        .unwrap();
    let mut new_category = payload("Cameron", 2.0);
    new_category.ratings[0].name = "Leadership".to_string();
    let failed_rating = rushee::post_comment(path(), Json(new_category))
        .await
        .unwrap()
        .0;
    assert_eq!(
        failed_rating,
        json!({
            "status": "error", "message": "there was an error updating the rushee's global ratings"
        })
    );
    let rejected = stored_rushee().await;
    assert_eq!(rejected.comments.len(), 1);
    assert_eq!(rejected.ratings.len(), 1);
    assert_eq!(rejected.ratings[0].name, "Professionalism");
    assert_eq!(rejected.ratings[0].value, 2.0);
    database
        .run_command(doc! { "collMod": "rushees", "validator": {} })
        .await
        .unwrap();

    // Reject rating removal after the stored comment has already been pulled.
    database
        .run_command(doc! {
            "collMod": "rushees",
            "validator": { "$jsonSchema": {
                "bsonType": "object",
                "properties": { "ratings": { "bsonType": "array", "minItems": 1 } }
            } }
        })
        .await
        .unwrap();
    let last_comment = stored_rushee().await.comments[0].clone();
    let failed_removal = rushee::delete_comment(path(), Json(last_comment))
        .await
        .unwrap()
        .0;
    assert_eq!(
        failed_removal,
        json!({
            "status": "error", "message": "error removing rating category after comment deletion"
        })
    );
    let partial_delete = stored_rushee().await;
    assert!(partial_delete.comments.is_empty());
    assert_eq!(partial_delete.ratings.len(), 1);
    assert_eq!(partial_delete.ratings[0].value, 2.0);
    database
        .run_command(doc! { "collMod": "rushees", "validator": {} })
        .await
        .unwrap();
    println!(
        "comment duplication, legacy ratings, text-only editing, and deletion contracts passed"
    );
}
