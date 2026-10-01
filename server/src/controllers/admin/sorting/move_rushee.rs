use super::{validate_status, MoveRusheePayload, SORTING_COLUMN_LOCKS};
use crate::controllers::db;
use axum::extract::Extension;
use axum::{http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::{doc, DateTime};
use mongodb::Collection;
use serde_json::{json, Value};

use crate::middlewares::auth::FirebaseUser;
use crate::models::rushee::RusheeModel;

async fn write_column_order(
    collection: &Collection<RusheeModel>,
    ids: &[String],
    column: &str,
    user: &FirebaseUser,
) -> mongodb::error::Result<()> {
    // Keep one write and timestamp per rushee; a failed update leaves earlier writes in place.
    for (idx, id_str) in ids.iter().enumerate() {
        let filter = doc! { "gtid": id_str };
        let update = doc! {
            "$set": {
                "sorting_status": column,
                "sorting_order": (idx as i32) + 1,
                "status_updated_at": DateTime::now(),
                "status_updated_by": user.email.clone().unwrap_or(user.uid.clone()),
            }
        };
        collection.update_one(filter, update).await?;
    }
    Ok(())
}

/// Move a single rushee within or across columns using current DB order
pub async fn move_rushee(
    Extension(user): Extension<crate::middlewares::auth::FirebaseUser>,
    Json(payload): Json<MoveRusheePayload>,
) -> Result<Json<Value>, StatusCode> {
    if !validate_status(&payload.from_column) || !validate_status(&payload.to_column) {
        return Ok(Json(json!({
            "status": "error",
            "message": "Invalid column"
        })));
    }

    let from_column = payload.from_column.clone();
    let to_column = payload.to_column.clone();

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

    let target_index = if payload.target_index < 0 {
        0
    } else {
        payload.target_index as usize
    };

    if from_column == to_column {
        let mut ids: Vec<String> = fetch_ids(&collection, &from_column).await?;
        let pos = ids.iter().position(|id| id == &payload.moved_rushee_id);
        let Some(pos) = pos else {
            return Ok(Json(json!({
                "status": "error",
                "message": "Rushee not found in source column"
            })));
        };
        ids.remove(pos);
        let insert_at = std::cmp::min(target_index, ids.len());
        ids.insert(insert_at, payload.moved_rushee_id.clone());

        if write_column_order(&collection, &ids, &from_column, &user)
            .await
            .is_err()
        {
            return Ok(Json(json!({
                "status": "error",
                "message": "Failed to move rushee"
            })));
        }
    } else {
        let mut from_ids: Vec<String> = fetch_ids(&collection, &from_column).await?;
        let mut to_ids: Vec<String> = fetch_ids(&collection, &to_column).await?;

        let pos = from_ids
            .iter()
            .position(|id| id == &payload.moved_rushee_id);
        let Some(pos) = pos else {
            return Ok(Json(json!({
                "status": "error",
                "message": "Rushee not found in source column"
            })));
        };
        from_ids.remove(pos);
        let insert_at = std::cmp::min(target_index, to_ids.len());
        to_ids.insert(insert_at, payload.moved_rushee_id.clone());

        if write_column_order(&collection, &from_ids, &from_column, &user)
            .await
            .is_err()
        {
            return Ok(Json(json!({
                "status": "error",
                "message": "Failed to move rushee"
            })));
        }

        if write_column_order(&collection, &to_ids, &to_column, &user)
            .await
            .is_err()
        {
            return Ok(Json(json!({
                "status": "error",
                "message": "Failed to move rushee"
            })));
        }
    }

    Ok(Json(json!({
        "status": "success"
    })))
}
