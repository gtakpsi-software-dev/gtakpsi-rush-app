use axum::{Extension, Json};
use bson::doc;
use serde_json::{json, Value};

use super::fixtures::reset;
use crate::{
    controllers::{admin, db},
    middlewares::auth::FirebaseUser,
    models::pis::{CheckAccessPayload, UpdateRushAppPayload},
};

mod failure_cases;

async fn check_access(is_admin: bool, is_bidcom: bool) -> Value {
    admin::check_rush_app_access(Json(CheckAccessPayload {
        uid: "brother-1".to_string(),
        is_admin,
        is_bidcom,
    }))
    .await
    .unwrap()
    .0
}

pub async fn check_contracts() {
    reset().await;

    let default_status = admin::get_rush_app_status().await.unwrap().0;
    assert_eq!(
        default_status,
        json!({
            "status": "success",
            "disable_bidcom": false,
            "disable_regular": false,
            "midterm_mode": false,
            "updated_at": null,
            "updated_by": null,
        })
    );
    assert_eq!(
        admin::get_midterm_mode_status().await.unwrap().0,
        json!({"status": "success", "midterm_mode": false})
    );
    assert_eq!(
        check_access(false, false).await,
        json!({"status": "success", "allowed": true, "reason": null})
    );

    let email_user = Extension(FirebaseUser {
        uid: "admin-1".to_string(),
        email: Some("admin@example.invalid".to_string()),
        is_admin: true,
        is_bidcom: false,
    });
    let response = admin::update_rush_app_settings(
        email_user,
        Json(UpdateRushAppPayload {
            disable_bidcom: true,
            disable_regular: true,
            midterm_mode: true,
        }),
    )
    .await
    .unwrap()
    .0;
    assert_eq!(
        response,
        json!({"status": "success", "message": "Rush App settings updated"})
    );

    let stored = db::get_rush_app_status_client()
        .await
        .find_one(doc! {})
        .await
        .unwrap()
        .unwrap();
    assert!(stored.updated_at.is_some());
    assert_eq!(stored.updated_by.as_deref(), Some("admin@example.invalid"));
    let status = admin::get_rush_app_status().await.unwrap().0;
    assert_eq!(status["status"], "success");
    assert_eq!(status["disable_bidcom"], true);
    assert_eq!(status["disable_regular"], true);
    assert_eq!(status["midterm_mode"], true);
    assert_eq!(status["updated_by"], "admin@example.invalid");
    assert_eq!(
        admin::get_midterm_mode_status().await.unwrap().0,
        json!({"status": "success", "midterm_mode": true})
    );
    assert_eq!(
        check_access(true, false).await,
        json!({"status": "success", "allowed": true, "reason": null})
    );
    assert_eq!(
        check_access(false, true).await,
        json!({
            "status": "success",
            "allowed": false,
            "reason": "The Rush App has been temporarily disabled for bid committee members."
        })
    );
    assert_eq!(
        check_access(false, false).await,
        json!({
            "status": "success",
            "allowed": false,
            "reason": "The Rush App has been temporarily disabled by an administrator."
        })
    );

    let uid_user = Extension(FirebaseUser {
        uid: "admin-2".to_string(),
        email: None,
        is_admin: true,
        is_bidcom: false,
    });
    let response = admin::update_rush_app_settings(
        uid_user,
        Json(UpdateRushAppPayload {
            disable_bidcom: false,
            disable_regular: true,
            midterm_mode: false,
        }),
    )
    .await
    .unwrap();
    assert_eq!(response.0["status"], "success");
    let collection = db::get_rush_app_status_client().await;
    assert_eq!(collection.count_documents(doc! {}).await.unwrap(), 1);
    assert_eq!(
        collection
            .find_one(doc! {})
            .await
            .unwrap()
            .unwrap()
            .updated_by
            .as_deref(),
        Some("admin-2")
    );
    assert_eq!(
        check_access(false, true).await,
        json!({"status": "success", "allowed": true, "reason": null})
    );
    assert_eq!(check_access(false, false).await["allowed"], false);
    assert_eq!(
        admin::get_midterm_mode_status().await.unwrap().0,
        json!({"status": "success", "midterm_mode": false})
    );
    failure_cases::check_contracts().await;
    println!(
        "rush app access defaults, role gates, status update, and attribution contracts passed"
    );
}
