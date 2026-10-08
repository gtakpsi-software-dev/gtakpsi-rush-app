use axum::{http::StatusCode, response::Json};
use serde_json::{json, Value};

use super::read_rushees::map_rushees;

// Return names and GTIDs with three-digit numbers assigned in database iteration order.
pub async fn export_rushee_numbers() -> Result<Json<Value>, StatusCode> {
    let mut order = 1;
    let rows = map_rushees(|rushee| {
        let row = json!({
            "rushee_number": format!("{:03}", order),
            "name": format!("{} {}", rushee.first_name, rushee.last_name),
            "gtid": rushee.gtid,
        });
        order += 1;
        row
    })
    .await;

    match rows {
        Ok(payload) => Ok(Json(json!({"status": "success", "payload": payload}))),
        Err(response) => Ok(response),
    }
}
