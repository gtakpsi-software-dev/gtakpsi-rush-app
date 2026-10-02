use super::NotesPayload;
use crate::storage::db;
use axum::extract::Extension;
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::{doc, DateTime};
use serde_json::{json, Value};

/// Get notes for rushee
pub async fn get_rushee_notes(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let collection: mongodb::Collection<crate::models::rushee::RusheeModel> =
        db::get_rushee_collection().await;
    let filter = doc! { "gtid": id.clone() };
    match collection.find_one(filter).await {
        Ok(Some(doc)) => Ok(Json(json!({
            "status": "success",
            "sortingNotes": doc.sorting_notes,
            "sortingTags": doc.sorting_tags,
            "notesUpdatedAt": doc.notes_updated_at,
            "notesUpdatedBy": doc.notes_updated_by,
            "sortingStatus": doc.sorting_status,
        }))),
        Ok(None) => Ok(Json(json!({
            "status": "error",
            "message": "Rushee not found"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to fetch notes"
        }))),
    }
}

/// Update rushee notes (autosave)
pub async fn update_rushee_notes(
    Path(id): Path<String>,
    Extension(user): Extension<crate::middlewares::auth::FirebaseUser>,
    Json(payload): Json<NotesPayload>,
) -> Result<Json<Value>, StatusCode> {
    let collection: mongodb::Collection<crate::models::rushee::RusheeModel> =
        db::get_rushee_collection().await;
    let filter = doc! { "gtid": id.clone() };

    // Bound stored notes to the existing 5,000-byte contract; reject oversized
    // text before any write instead of silently truncating a brother's input.
    if payload.sorting_notes.len() > 5000 {
        return Ok(Json(json!({
            "status": "error",
            "message": "Notes too long"
        })));
    }

    // Validate tags
    let valid_tags = [
        "night_1",
        "night_2",
        "closed_night",
        "closed_night_invite",
        "pis",
        "hard_no",
    ];
    let filtered_tags: Vec<&str> = payload
        .sorting_tags
        .iter()
        .filter(|t| valid_tags.contains(&t.as_str()))
        .map(|t| t.as_str())
        .collect();

    let update = doc! {
        "$set": {
            "sorting_notes": &payload.sorting_notes,
            "sorting_tags": &filtered_tags,
            "notes_updated_at": DateTime::now(),
            "notes_updated_by": user.email.clone().unwrap_or(user.uid.clone()),
        }
    };

    match collection.update_one(filter, update).await {
        Ok(_) => Ok(Json(json!({
            "status": "success"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to update notes"
        }))),
    }
}
