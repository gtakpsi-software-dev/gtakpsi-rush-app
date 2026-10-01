use super::{validate_status, SortingRushee, SORTING_STATUSES};
use crate::{controllers::db, models::rushee::RusheeModel};
use axum::{http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::doc;
use serde_json::{json, Value};

#[derive(Clone, Copy)]
enum SortingAudience {
    Admin,
    Public,
}

fn project_sorting_rushee(
    document: &RusheeModel,
    order_counter: i32,
    audience: SortingAudience,
) -> SortingRushee {
    let sorting_status = if validate_status(&document.sorting_status) {
        document.sorting_status.clone()
    } else {
        "UNSORTED".to_string()
    };
    let sorting_order = if document.sorting_order > 0 {
        document.sorting_order
    } else {
        order_counter
    };

    // INVARIANT: Public board cards retain their schema but never reveal rush numbers.
    let rush_number = match audience {
        SortingAudience::Admin => document.rush_number.unwrap_or(order_counter),
        SortingAudience::Public => 0,
    };

    SortingRushee {
        id: document.gtid.clone(),
        full_name: format!("{} {}", document.first_name, document.last_name),
        rush_number,
        sorting_status,
        sorting_order,
        sorting_tags: document.sorting_tags.clone(),
    }
}

fn sort_sorting_rushees(list: &mut [SortingRushee]) {
    list.sort_by(|a, b| {
        let ai = SORTING_STATUSES
            .iter()
            .position(|status| *status == a.sorting_status)
            .unwrap_or(0);
        let bi = SORTING_STATUSES
            .iter()
            .position(|status| *status == b.sorting_status)
            .unwrap_or(0);
        ai.cmp(&bi)
            .then(a.sorting_order.cmp(&b.sorting_order))
            .then_with(|| a.id.cmp(&b.id))
    });
}

async fn load_sorting_rushees(audience: SortingAudience) -> Result<Json<Value>, StatusCode> {
    let collection: mongodb::Collection<RusheeModel> = db::get_rushee_client().await;

    let cursor_result = collection.find(doc! {}).await;
    match cursor_result {
        Ok(mut cursor) => {
            let mut list = Vec::new();
            let mut order_counter = 1;
            while let Some(item) = cursor.next().await {
                if let Ok(document) = item {
                    list.push(project_sorting_rushee(&document, order_counter, audience));
                    order_counter += 1;
                }
            }

            sort_sorting_rushees(&mut list);
            Ok(Json(json!({ "status": "success", "payload": list })))
        }
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to fetch rushees"
        }))),
    }
}

/// Fetch all rushees for sorting board.
pub async fn get_sorting_rushees() -> Result<Json<Value>, StatusCode> {
    load_sorting_rushees(SortingAudience::Admin).await
}

/// Public view of the sorting board for authenticated brothers.
pub async fn get_sorting_rushees_public() -> Result<Json<Value>, StatusCode> {
    load_sorting_rushees(SortingAudience::Public).await
}

#[cfg(test)]
mod tests;
