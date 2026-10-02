use super::{validate_status, BulkReorderPayload, UpdateSortingPayload, SORTING_REORDER_LOCK};
use crate::storage::db;
use axum::extract::Extension;
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::{doc, DateTime};
use serde_json::{json, Value};

/// Update sorting status and order for a single rushee (used on drop)
pub async fn update_rushee_sorting(
    Path(id): Path<String>,
    Extension(user): Extension<crate::middlewares::auth::FirebaseUser>,
    Json(payload): Json<UpdateSortingPayload>,
) -> Result<Json<Value>, StatusCode> {
    if !validate_status(&payload.sorting_status) {
        return Ok(Json(json!({
            "status": "error",
            "message": "Invalid sorting status"
        })));
    }

    let collection: mongodb::Collection<crate::models::rushee::RusheeModel> =
        db::get_rushee_client().await;
    let filter = doc! { "gtid": id.clone() };

    let update = doc! {
        "$set": {
            "sorting_status": &payload.sorting_status,
            "sorting_order": payload.sorting_order,
            "status_updated_at": DateTime::now(),
            "status_updated_by": user.email.clone().unwrap_or(user.uid.clone()),
        }
    };

    match collection.update_one(filter, update).await {
        Ok(_) => Ok(Json(json!({
            "status": "success"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to update sorting status"
        }))),
    }
}

/// Bulk reorder a column (and set status)
pub async fn bulk_reorder(
    Extension(user): Extension<crate::middlewares::auth::FirebaseUser>,
    Json(payload): Json<BulkReorderPayload>,
) -> Result<Json<Value>, StatusCode> {
    let _lock = SORTING_REORDER_LOCK.lock().await;

    if !validate_status(&payload.column) {
        return Ok(Json(json!({
            "status": "error",
            "message": "Invalid column"
        })));
    }

    let collection: mongodb::Collection<crate::models::rushee::RusheeModel> =
        db::get_rushee_client().await;

    for (idx, id_str) in payload.ordered_rushee_ids.iter().enumerate() {
        let filter = doc! { "gtid": id_str };
        let update = doc! {
            "$set": {
                "sorting_status": &payload.column,
                "sorting_order": (idx as i32) + 1,
                "status_updated_at": DateTime::now(),
                "status_updated_by": user.email.clone().unwrap_or(user.uid.clone()),
            }
        };
        if let Err(_) = collection.update_one(filter, update).await {
            return Ok(Json(json!({
                "status": "error",
                "message": "Failed to reorder"
            })));
        }
    }

    Ok(Json(json!({
        "status": "success"
    })))
}
