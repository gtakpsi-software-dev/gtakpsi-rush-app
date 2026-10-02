use axum::response::Json;
use mongodb::bson::doc;
use serde_json::{json, Value};

use crate::{
    models::rushee::RusheeModel,
    storage::{cursor_rows::for_each_strict_row, db},
};

pub(super) async fn map_rushees(
    mut map: impl FnMut(RusheeModel) -> Value,
) -> Result<Vec<Value>, Json<Value>> {
    let collection = db::get_rushee_client().await;
    let cursor = match collection.find(doc! {}).await {
        Ok(cursor) => cursor,
        Err(_) => {
            return Err(Json(json!({
                "status": "error",
                "message": "Database error"
            })));
        }
    };

    let mut rows = Vec::new();
    if let Err(err) = for_each_strict_row(cursor, |rushee| rows.push(map(rushee))).await {
        println!("{err}");
        return Err(Json(json!({
            "status": "error",
            "message": "Error reading rushee data"
        })));
    }

    Ok(rows)
}
