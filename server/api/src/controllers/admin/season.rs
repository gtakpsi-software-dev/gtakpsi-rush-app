use axum::{http::StatusCode, Json};
use mongodb::bson::{doc, Document};
use serde_json::{json, Value};

use crate::storage::db;

pub async fn reset_season() -> Result<Json<Value>, StatusCode> {
    let client = db::get_mongo_client().await;
    let database = client.database("rush-app");

    // INVARIANT: only the four existing season-reset collections may be cleared.
    // Keep admin authentication on this route; no client-supplied collection names.
    for name in ["rushees", "rush-nights", "pis-timeslots", "pis-questions"] {
        database
            .collection::<Document>(name)
            .delete_many(doc! {})
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    // Collection deletes are sequential, not transactional; failure stops the caller
    // before Storage cleanup and seeding, but earlier deletes may have completed.
    Ok(Json(json!({"status": "success"})))
}
