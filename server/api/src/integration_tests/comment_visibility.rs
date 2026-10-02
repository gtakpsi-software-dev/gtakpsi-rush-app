use axum::{Extension, Json};
use bson::doc;
use serde_json::json;

use super::fixtures::reset;
use crate::{
    controllers::{admin, db},
    middlewares::auth::FirebaseUser,
    models::pis::UpdateCommentVisibilityPayload,
};

pub async fn check_contracts() {
    reset().await;

    assert_eq!(
        admin::get_comment_visibility_settings().await.unwrap().0,
        json!({
            "status": "success",
            "require_comment_to_view": true,
            "updated_at": null,
            "updated_by": null,
        })
    );
    assert_eq!(
        admin::get_comment_visibility_status().await.unwrap().0,
        json!({"status": "success", "require_comment_to_view": true})
    );

    let email_user = Extension(FirebaseUser {
        uid: "admin-1".to_string(),
        email: Some("admin@example.invalid".to_string()),
        is_admin: true,
        is_bidcom: false,
    });
    assert_eq!(
        admin::update_comment_visibility_settings(
            email_user,
            Json(UpdateCommentVisibilityPayload {
                require_comment_to_view: false,
            }),
        )
        .await
        .unwrap()
        .0,
        json!({"status": "success", "message": "Comment visibility settings updated"})
    );

    let collection = db::get_comment_visibility_settings_client().await;
    let stored = collection.find_one(doc! {}).await.unwrap().unwrap();
    assert!(!stored.require_comment_to_view);
    assert!(stored.updated_at.is_some());
    assert_eq!(stored.updated_by.as_deref(), Some("admin@example.invalid"));
    assert_eq!(
        admin::get_comment_visibility_status().await.unwrap().0,
        json!({"status": "success", "require_comment_to_view": false})
    );
    let admin_status = admin::get_comment_visibility_settings().await.unwrap().0;
    assert_eq!(admin_status["status"], "success");
    assert_eq!(admin_status["require_comment_to_view"], false);
    assert_eq!(admin_status["updated_by"], "admin@example.invalid");
    assert!(!admin_status["updated_at"].is_null());

    let uid_user = Extension(FirebaseUser {
        uid: "admin-2".to_string(),
        email: None,
        is_admin: true,
        is_bidcom: false,
    });
    let response = admin::update_comment_visibility_settings(
        uid_user,
        Json(UpdateCommentVisibilityPayload {
            require_comment_to_view: true,
        }),
    )
    .await
    .unwrap();
    assert_eq!(response.0["status"], "success");
    assert_eq!(collection.count_documents(doc! {}).await.unwrap(), 1);
    let stored = collection.find_one(doc! {}).await.unwrap().unwrap();
    assert!(stored.require_comment_to_view);
    assert_eq!(stored.updated_by.as_deref(), Some("admin-2"));

    // A malformed settings record exposes an admin error but keeps the public default enabled.
    collection.delete_many(doc! {}).await.unwrap();
    db::get_mongo_client()
        .await
        .database("rush-app")
        .collection::<bson::Document>("comment-visibility-settings")
        .insert_one(doc! {"require_comment_to_view": "invalid"})
        .await
        .unwrap();
    assert_eq!(
        admin::get_comment_visibility_settings().await.unwrap().0,
        json!({"status": "error", "message": "Failed to fetch comment visibility settings"})
    );
    assert_eq!(
        admin::get_comment_visibility_status().await.unwrap().0,
        json!({"status": "success", "require_comment_to_view": true})
    );

    collection.delete_many(doc! {}).await.unwrap();
    let user = Extension(FirebaseUser {
        uid: "admin-3".to_string(),
        email: None,
        is_admin: true,
        is_bidcom: false,
    });
    assert_eq!(
        admin::update_comment_visibility_settings(
            user.clone(),
            Json(UpdateCommentVisibilityPayload {
                require_comment_to_view: true,
            }),
        )
        .await
        .unwrap()
        .0["status"],
        "success"
    );

    // Reject insertion after deletion to pin the existing non-atomic replacement behavior.
    let database = db::get_mongo_client().await.database("rush-app");
    database
        .run_command(doc! {
            "collMod": "comment-visibility-settings",
            "validator": { "$jsonSchema": {
                "bsonType": "object",
                "properties": { "require_comment_to_view": { "enum": [true] } }
            } }
        })
        .await
        .unwrap();
    assert_eq!(
        admin::update_comment_visibility_settings(
            user,
            Json(UpdateCommentVisibilityPayload {
                require_comment_to_view: false,
            }),
        )
        .await
        .unwrap()
        .0,
        json!({"status": "error", "message": "Failed to update comment visibility settings"})
    );
    assert_eq!(collection.count_documents(doc! {}).await.unwrap(), 0);
    assert_eq!(
        admin::get_comment_visibility_status().await.unwrap().0,
        json!({"status": "success", "require_comment_to_view": true})
    );
    database
        .run_command(doc! { "collMod": "comment-visibility-settings", "validator": {} })
        .await
        .unwrap();

    println!("comment visibility defaults, updates, attribution, and fallback contracts passed");
}
