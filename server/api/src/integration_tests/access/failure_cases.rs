use axum::{Extension, Json};
use bson::doc;
use serde_json::json;

use super::check_access;
use crate::{
    controllers::admin, middlewares::auth::FirebaseUser, models::pis::UpdateRushAppPayload,
    storage::db,
};

pub(super) async fn check_contracts() {
    let collection = db::get_rush_app_status_client().await;
    let stored = collection.find_one(doc! {}).await.unwrap().unwrap();
    assert!(stored.disable_regular);

    // Reject insertion after deletion to pin the current default-open failure state.
    let database = db::get_mongo_client().await.database("rush-app");
    database
        .run_command(doc! {
            "collMod": "rush-app-status",
            "validator": { "$jsonSchema": {
                "bsonType": "object",
                "properties": { "disable_regular": { "enum": [true] } }
            } }
        })
        .await
        .unwrap();
    let response = admin::update_rush_app_settings(
        Extension(FirebaseUser {
            uid: "admin-3".to_string(),
            email: None,
            is_admin: true,
            is_bidcom: false,
        }),
        Json(UpdateRushAppPayload {
            disable_bidcom: false,
            disable_regular: false,
            midterm_mode: false,
        }),
    )
    .await
    .unwrap();
    assert_eq!(
        response.0,
        json!({"status": "error", "message": "Failed to update Rush App settings"})
    );
    assert_eq!(collection.count_documents(doc! {}).await.unwrap(), 0);
    assert_eq!(
        check_access(false, false).await,
        json!({"status": "success", "allowed": true, "reason": null})
    );
    assert_eq!(
        admin::get_midterm_mode_status().await.unwrap().0,
        json!({"status": "success", "midterm_mode": false})
    );
    database
        .run_command(doc! { "collMod": "rush-app-status", "validator": {} })
        .await
        .unwrap();

    // A malformed record fails the admin read but keeps the public midterm default off.
    database
        .collection::<bson::Document>("rush-app-status")
        .insert_one(doc! {"midterm_mode": "invalid"})
        .await
        .unwrap();
    assert_eq!(
        admin::get_rush_app_status().await.unwrap().0,
        json!({"status": "error", "message": "Failed to fetch Rush App status"})
    );
    assert_eq!(
        admin::get_midterm_mode_status().await.unwrap().0,
        json!({"status": "success", "midterm_mode": false})
    );
    database
        .collection::<bson::Document>("rush-app-status")
        .delete_many(doc! {})
        .await
        .unwrap();
}
