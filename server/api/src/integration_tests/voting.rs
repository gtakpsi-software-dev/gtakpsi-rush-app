use axum::{http::StatusCode, Json};
use bson::doc;
use serde_json::json;

use super::fixtures::reset;
use crate::{controllers::voting, storage::db};

pub async fn check_missing_rushee_contracts() {
    reset().await;
    let missing = Json(serde_json::from_value(json!({"gtid": "absent"})).unwrap());
    assert_eq!(
        voting::change_rushee(missing).await.unwrap_err(),
        StatusCode::NOT_FOUND
    );

    let collection = db::get_mongo_client()
        .await
        .database("rush-app")
        .collection::<bson::Document>("rushees");
    collection
        .insert_one(doc! {"gtid": "malformed"})
        .await
        .unwrap();

    // The current lookup maps malformed stored rows to the same response as
    // absent rushees; both paths stop before opening a Redis connection.
    let malformed = Json(serde_json::from_value(json!({"gtid": "malformed"})).unwrap());
    assert_eq!(
        voting::change_rushee(malformed).await.unwrap_err(),
        StatusCode::NOT_FOUND
    );
    reset().await;
}
