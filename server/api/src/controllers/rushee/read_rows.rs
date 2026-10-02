use axum::response::Json;
use futures::stream::StreamExt;
use mongodb::bson::doc;
use mongodb::Collection;
use serde_json::{json, Value};

use crate::models::rushee::RusheeModel;

pub(super) async fn map_rushee_rows<T>(
    collection: Collection<RusheeModel>,
    mut map: impl FnMut(RusheeModel) -> T,
) -> Result<Vec<T>, Json<Value>> {
    let mut cursor = match collection.find(doc! {}).await {
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
    while let Some(result) = cursor.next().await {
        match result {
            Ok(rushee) => rows.push(map(rushee)),
            Err(err) => {
                println!("{err}");
                return Err(Json(json!({
                    "status": "error",
                    "message": "there was an error pushing the stripped rushee to the array"
                })));
            }
        }
    }

    Ok(rows)
}
