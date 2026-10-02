use super::{
    column_order::{fetch_ids, write_column_order},
    validate_status, MoveRusheePayload, SORTING_COLUMN_LOCKS,
};
use crate::services::sorting_order::{move_between_columns, move_within_column};
use crate::storage::db;
use axum::extract::Extension;
use axum::{http::StatusCode, response::Json};
use serde_json::{json, Value};

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

    if from_column == to_column {
        let ids = fetch_ids(&collection, &from_column).await?;
        let Some(ids) = move_within_column(ids, &payload.moved_rushee_id, payload.target_index)
        else {
            return Ok(Json(json!({
                "status": "error",
                "message": "Rushee not found in source column"
            })));
        };

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
        let from_ids = fetch_ids(&collection, &from_column).await?;
        let to_ids = fetch_ids(&collection, &to_column).await?;

        let Some((from_ids, to_ids)) = move_between_columns(
            from_ids,
            to_ids,
            &payload.moved_rushee_id,
            payload.target_index,
        ) else {
            return Ok(Json(json!({
                "status": "error",
                "message": "Rushee not found in source column"
            })));
        };

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
