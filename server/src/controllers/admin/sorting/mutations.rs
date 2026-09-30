use super::{
    validate_status, BulkReorderPayload, MoveRusheePayload, UpdateSortingPayload,
    SORTING_COLUMN_LOCKS, SORTING_REORDER_LOCK,
};
use crate::controllers::db;
use axum::extract::Extension;
use axum::{extract::Path, http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::{doc, DateTime};
use serde_json::{json, Value};

/// Update sorting status and order for a single rushee (used on drop)
pub async fn update_rushee_sorting(
    Path(id): Path<String>,
    Extension(user): Extension<crate::middlewares::auth::FirebaseUser>,
    Json(payload): Json<UpdateSortingPayload>,
) -> Result<Json<Value>, StatusCode> {
    if !validate_status(&payload.sortingStatus) {
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
            "sorting_status": &payload.sortingStatus,
            "sorting_order": payload.sortingOrder,
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

    for (idx, id_str) in payload.orderedRusheeIds.iter().enumerate() {
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

/// Move a single rushee within or across columns using current DB order
pub async fn move_rushee(
    Extension(user): Extension<crate::middlewares::auth::FirebaseUser>,
    Json(payload): Json<MoveRusheePayload>,
) -> Result<Json<Value>, StatusCode> {
    if !validate_status(&payload.fromColumn) || !validate_status(&payload.toColumn) {
        return Ok(Json(json!({
            "status": "error",
            "message": "Invalid column"
        })));
    }

    let from_column = payload.fromColumn.clone();
    let to_column = payload.toColumn.clone();

    // Acquire column locks in deterministic order to avoid deadlocks
    let (first, second) = if from_column <= to_column {
        (from_column.clone(), to_column.clone())
    } else {
        (to_column.clone(), from_column.clone())
    };

    let first_lock = SORTING_COLUMN_LOCKS
        .get(&first)
        .cloned()
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;
    let _guard_first = first_lock.lock().await;
    let second_lock = if first != second {
        Some(
            SORTING_COLUMN_LOCKS
                .get(&second)
                .cloned()
                .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?,
        )
    } else {
        None
    };
    let _guard_second = if let Some(lock) = &second_lock {
        Some(lock.lock().await)
    } else {
        None
    };

    let collection: mongodb::Collection<crate::models::rushee::RusheeModel> =
        db::get_rushee_client().await;

    async fn fetch_ids(
        collection: &mongodb::Collection<crate::models::rushee::RusheeModel>,
        column: &str,
    ) -> Result<Vec<String>, StatusCode> {
        let cursor = collection.find(doc! { "sorting_status": column }).await;
        match cursor {
            Ok(mut cursor) => {
                let mut items: Vec<(i32, String)> = Vec::new();
                while let Some(item) = cursor.next().await {
                    if let Ok(doc) = item {
                        items.push((doc.sorting_order, doc.gtid));
                    }
                }
                items.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.cmp(&b.1)));
                Ok(items.into_iter().map(|(_, id)| id).collect())
            }
            Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
        }
    }

    let target_index = if payload.targetIndex < 0 {
        0
    } else {
        payload.targetIndex as usize
    };

    if from_column == to_column {
        let mut ids: Vec<String> = fetch_ids(&collection, &from_column).await?;
        let pos = ids.iter().position(|id| id == &payload.movedRusheeId);
        let Some(pos) = pos else {
            return Ok(Json(json!({
                "status": "error",
                "message": "Rushee not found in source column"
            })));
        };
        ids.remove(pos);
        let insert_at = std::cmp::min(target_index, ids.len());
        ids.insert(insert_at, payload.movedRusheeId.clone());

        for (idx, id_str) in ids.iter().enumerate() {
            let filter = doc! { "gtid": id_str };
            let update = doc! {
                "$set": {
                    "sorting_status": &from_column,
                    "sorting_order": (idx as i32) + 1,
                    "status_updated_at": DateTime::now(),
                    "status_updated_by": user.email.clone().unwrap_or(user.uid.clone()),
                }
            };
            if let Err(_) = collection.update_one(filter, update).await {
                return Ok(Json(json!({
                    "status": "error",
                    "message": "Failed to move rushee"
                })));
            }
        }
    } else {
        let mut from_ids: Vec<String> = fetch_ids(&collection, &from_column).await?;
        let mut to_ids: Vec<String> = fetch_ids(&collection, &to_column).await?;

        let pos = from_ids.iter().position(|id| id == &payload.movedRusheeId);
        let Some(pos) = pos else {
            return Ok(Json(json!({
                "status": "error",
                "message": "Rushee not found in source column"
            })));
        };
        from_ids.remove(pos);
        let insert_at = std::cmp::min(target_index, to_ids.len());
        to_ids.insert(insert_at, payload.movedRusheeId.clone());

        for (idx, id_str) in from_ids.iter().enumerate() {
            let filter = doc! { "gtid": id_str };
            let update = doc! {
                "$set": {
                    "sorting_status": &from_column,
                    "sorting_order": (idx as i32) + 1,
                    "status_updated_at": DateTime::now(),
                    "status_updated_by": user.email.clone().unwrap_or(user.uid.clone()),
                }
            };
            if let Err(_) = collection.update_one(filter, update).await {
                return Ok(Json(json!({
                    "status": "error",
                    "message": "Failed to move rushee"
                })));
            }
        }

        for (idx, id_str) in to_ids.iter().enumerate() {
            let filter = doc! { "gtid": id_str };
            let update = doc! {
                "$set": {
                    "sorting_status": &to_column,
                    "sorting_order": (idx as i32) + 1,
                    "status_updated_at": DateTime::now(),
                    "status_updated_by": user.email.clone().unwrap_or(user.uid.clone()),
                }
            };
            if let Err(_) = collection.update_one(filter, update).await {
                return Ok(Json(json!({
                    "status": "error",
                    "message": "Failed to move rushee"
                })));
            }
        }
    }

    Ok(Json(json!({
        "status": "success"
    })))
}
