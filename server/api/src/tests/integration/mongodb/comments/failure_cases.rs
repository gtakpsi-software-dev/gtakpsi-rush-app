use super::super::fixtures::{path, stored_rushee};
use super::payload;
use crate::{controllers::rushee, storage::db};
use axum::Json;
use bson::doc;
use serde_json::json;

// Verify stored comments and ratings after rejected edits, appends, deletions, and rating writes.
pub(super) async fn check_contracts() {
    let database = db::get_mongo_client().await.database("rush-app");
    let mut blocked_edit = stored_rushee().await.comments[0].clone();
    blocked_edit.comment = "Blocked edit".to_string();

    // Reject the comment text update without rejecting the existing document.
    database
        .run_command(doc! {
            "collMod": "rushees",
            "validator": { "comments.comment": { "$ne": "Blocked edit" } }
        })
        .await
        .unwrap();
    assert_eq!(
        rushee::edit_comment(path(), Json(blocked_edit))
            .await
            .unwrap()
            .0,
        json!({"status": "error", "message": "there was an error pushing the update to the database"})
    );
    assert_eq!(stored_rushee().await.comments[0].comment, "Observation");
    database
        .run_command(doc! { "collMod": "rushees", "validator": {} })
        .await
        .unwrap();

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

    // Reject the comment pull before any rating recalculation can run.
    database
        .run_command(doc! {
            "collMod": "rushees",
            "validator": { "$jsonSchema": {
                "bsonType": "object",
                "properties": { "comments": { "bsonType": "array", "minItems": 1 } }
            } }
        })
        .await
        .unwrap();
    let original_comment = stored_rushee().await.comments[0].clone();
    assert_eq!(
        rushee::delete_comment(path(), Json(original_comment))
            .await
            .unwrap()
            .0,
        json!({"status": "error", "message": "couldn't delete the comment from the database"})
    );
    let rejected_delete = stored_rushee().await;
    assert_eq!(rejected_delete.comments.len(), 1);
    assert_eq!(rejected_delete.ratings[0].value, 2.0);
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
}
