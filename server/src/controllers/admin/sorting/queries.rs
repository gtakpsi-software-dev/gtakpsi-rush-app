use super::{validate_status, SortingRushee, SORTING_STATUSES};
use crate::controllers::db;
use axum::{http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::doc;
use serde_json::{json, Value};

/// Fetch all rushees for sorting board
pub async fn get_sorting_rushees() -> Result<Json<Value>, StatusCode> {
    let collection: mongodb::Collection<crate::models::rushee::RusheeModel> =
        db::get_rushee_client().await;

    let cursor_result = collection.find(doc! {}).await;
    match cursor_result {
        Ok(mut cursor) => {
            let mut list: Vec<SortingRushee> = Vec::new();
            let mut order_counter: i32 = 1;
            while let Some(item) = cursor.next().await {
                if let Ok(doc) = item {
                    let status = if validate_status(&doc.sorting_status) {
                        doc.sorting_status.clone()
                    } else {
                        "UNSORTED".to_string()
                    };

                    let order = if doc.sorting_order > 0 {
                        doc.sorting_order
                    } else {
                        order_counter
                    };

                    let rush_number = doc.rush_number.unwrap_or(order_counter);

                    list.push(SortingRushee {
                        id: doc.gtid.clone(), // use gtid as id for consistency
                        full_name: format!("{} {}", doc.first_name, doc.last_name),
                        rush_number: rush_number,
                        sorting_status: status,
                        sorting_order: order,
                        sorting_tags: doc.sorting_tags.clone(),
                    });
                    order_counter += 1;
                }
            }

            // Stable ordering by status then order
            list.sort_by(|a, b| {
                let ai = SORTING_STATUSES
                    .iter()
                    .position(|s| *s == a.sorting_status)
                    .unwrap_or(0);
                let bi = SORTING_STATUSES
                    .iter()
                    .position(|s| *s == b.sorting_status)
                    .unwrap_or(0);
                ai.cmp(&bi)
                    .then(a.sorting_order.cmp(&b.sorting_order))
                    .then_with(|| a.id.cmp(&b.id))
            });

            Ok(Json(json!({
                "status": "success",
                "payload": list
            })))
        }
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to fetch rushees"
        }))),
    }
}

/// Public endpoint: Fetch rushees for sorting board (view-only, shows names)
/// Accessible to all authenticated brothers
pub async fn get_sorting_rushees_public() -> Result<Json<Value>, StatusCode> {
    let collection: mongodb::Collection<crate::models::rushee::RusheeModel> =
        db::get_rushee_client().await;

    let cursor_result = collection.find(doc! {}).await;
    match cursor_result {
        Ok(mut cursor) => {
            let mut list: Vec<SortingRushee> = Vec::new();
            let mut order_counter: i32 = 1;
            while let Some(item) = cursor.next().await {
                if let Ok(doc) = item {
                    let status = if validate_status(&doc.sorting_status) {
                        doc.sorting_status.clone()
                    } else {
                        "UNSORTED".to_string()
                    };

                    let order = if doc.sorting_order > 0 {
                        doc.sorting_order
                    } else {
                        order_counter
                    };

                    list.push(SortingRushee {
                        id: doc.gtid.clone(),
                        full_name: format!("{} {}", doc.first_name, doc.last_name),
                        rush_number: 0, // Don't expose rushee numbers to regular brothers
                        sorting_status: status,
                        sorting_order: order,
                        sorting_tags: doc.sorting_tags.clone(),
                    });
                    order_counter += 1;
                }
            }

            // Stable ordering by status then order
            list.sort_by(|a, b| {
                let ai = SORTING_STATUSES
                    .iter()
                    .position(|s| *s == a.sorting_status)
                    .unwrap_or(0);
                let bi = SORTING_STATUSES
                    .iter()
                    .position(|s| *s == b.sorting_status)
                    .unwrap_or(0);
                ai.cmp(&bi)
                    .then(a.sorting_order.cmp(&b.sorting_order))
                    .then_with(|| a.id.cmp(&b.id))
            });

            Ok(Json(json!({
                "status": "success",
                "payload": list
            })))
        }
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to fetch rushees"
        }))),
    }
}
