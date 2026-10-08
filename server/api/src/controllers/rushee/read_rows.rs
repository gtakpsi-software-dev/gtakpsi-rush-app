use axum::response::Json;
use mongodb::bson::doc;
use mongodb::Collection;
use serde_json::{json, Value};

use crate::models::rushee::RusheeModel;
use crate::storage::cursor_rows::for_each_strict_row;

// Map all rushee records into response rows, reporting query or decoding failures.
pub(super) async fn map_rushee_rows<T>(
    collection: Collection<RusheeModel>,
    mut map: impl FnMut(RusheeModel) -> T,
) -> Result<Vec<T>, Json<Value>> {
    let cursor = match collection.find(doc! {}).await {
        Ok(cursor) => cursor,
        Err(_) => {
            // The misspelled key is an existing wire response on this error path.
            return Err(Json(json!({
                "stauts": "error",
                "message": "some network error occurred"
            })));
        }
    };

    let mut rows = Vec::new();
    if let Err(err) = for_each_strict_row(cursor, |rushee| rows.push(map(rushee))).await {
        println!("{err}");
        return Err(Json(json!({
            "status": "error",
            "message": "there was an error pushing the stripped rushee to the array"
        })));
    }

    Ok(rows)
}
