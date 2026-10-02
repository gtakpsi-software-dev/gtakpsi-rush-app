use axum::response::Json;
use futures::stream::StreamExt;
use mongodb::bson::doc;
use serde_json::{json, Value};

use crate::{models::rushee::RusheeModel, storage::db};

pub(super) async fn map_rushees(
    mut map: impl FnMut(RusheeModel) -> Value,
) -> Result<Vec<Value>, Json<Value>> {
    let collection = db::get_rushee_client().await;
    let mut cursor = match collection.find(doc! {}).await {
        Ok(cursor) => cursor,
        Err(_) => {
            return Err(Json(json!({
                "status": "error",
                "message": "Database error"
            })));
        }
    };

    let mut rows = Vec::new();
    while let Some(row) = cursor.next().await {
        match row {
            Ok(rushee) => rows.push(map(rushee)),
            Err(err) => {
                println!("{err}");
                return Err(Json(json!({
                    "status": "error",
                    "message": "Error reading rushee data"
                })));
            }
        }
    }

    Ok(rows)
}
