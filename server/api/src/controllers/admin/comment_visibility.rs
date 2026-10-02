use crate::controllers::db;
use crate::models::pis::{CommentVisibilitySettings, UpdateCommentVisibilityPayload};
use axum::extract::Extension;
use axum::{http::StatusCode, response::Json};
use mongodb::bson::{doc, DateTime};
use serde_json::{json, Value};

// ========== Comment Visibility Settings Endpoints ==========

/// Update comment visibility settings (admin only)
/// When enabled, brothers only see their own comments on a rushee
pub async fn update_comment_visibility_settings(
    Extension(user): Extension<crate::middlewares::auth::FirebaseUser>,
    Json(payload): Json<UpdateCommentVisibilityPayload>,
) -> Result<Json<Value>, StatusCode> {
    let collection = db::get_comment_visibility_settings_client().await;

    // Readers take the first document, so replacement clears old settings first.
    // A failed insert leaves the public read on its enabled default.
    let _ = collection.delete_many(doc! {}).await;

    let settings = CommentVisibilitySettings {
        require_comment_to_view: payload.require_comment_to_view,
        updated_at: Some(DateTime::now()),
        updated_by: Some(user.email.clone().unwrap_or(user.uid.clone())),
    };

    match collection.insert_one(settings).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "Comment visibility settings updated"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to update comment visibility settings"
        }))),
    }
}

/// Get current comment visibility settings (admin only)
pub async fn get_comment_visibility_settings() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_comment_visibility_settings_client().await;

    match collection.find_one(doc! {}).await {
        Ok(Some(settings)) => Ok(Json(json!({
            "status": "success",
            "require_comment_to_view": settings.require_comment_to_view,
            "updated_at": settings.updated_at,
            "updated_by": settings.updated_by
        }))),
        Ok(None) => Ok(Json(json!({
            "status": "success",
            "require_comment_to_view": true,  // Default to enabled (existing behavior)
            "updated_at": null,
            "updated_by": null
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to fetch comment visibility settings"
        }))),
    }
}

/// Public endpoint to check if comment visibility restriction is enabled
pub async fn get_comment_visibility_status() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_comment_visibility_settings_client().await;

    match collection.find_one(doc! {}).await {
        Ok(Some(settings)) => Ok(Json(json!({
            "status": "success",
            "require_comment_to_view": settings.require_comment_to_view
        }))),
        Ok(None) => Ok(Json(json!({
            "status": "success",
            "require_comment_to_view": true  // Default to enabled (existing behavior)
        }))),
        Err(_) => Ok(Json(json!({
            "status": "success",
            "require_comment_to_view": true  // On error, default to existing behavior
        }))),
    }
}
