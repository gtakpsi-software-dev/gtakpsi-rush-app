use axum::{http::StatusCode, Json};
use bson::doc;
use serde_json::json;

use super::fixtures::reset;
use crate::{controllers::voting, storage::db};

#[cfg(feature = "redis-integration-tests")]
use super::fixtures::{register, GTID};
#[cfg(feature = "redis-integration-tests")]
use crate::models::rushee::RusheeModel;
#[cfg(feature = "redis-integration-tests")]
use futures::StreamExt;
#[cfg(feature = "redis-integration-tests")]
use redis::AsyncCommands;
#[cfg(feature = "redis-integration-tests")]
use std::{env, time::Duration};

// Verify that missing or malformed selections fail before Redis access.
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

// Verify MongoDB-to-Redis selection, publication, read-shape mismatch, and partial failures.
#[cfg(feature = "redis-integration-tests")]
pub async fn check_selected_rushee_contract() {
    let port = env::var("RUSH_TEST_REDIS_PORT").expect("Use the disposable Redis runner");
    let run_id = env::var("RUSH_TEST_REDIS_RUN_ID").expect("Missing Redis run marker");
    let url = format!("redis://127.0.0.1:{port}");
    assert_eq!(env::var("REDIS_URL").unwrap(), url);
    let mut redis = db::get_redis_manager().await.as_ref().clone();
    let guard: Option<String> = redis.get("_rush_voting_integration_guard").await.unwrap();
    // INVARIANT: clear selected-rushee state only after verifying both
    // disposable stores. The MongoDB guard is checked by database_contracts.
    assert_eq!(guard.as_deref(), Some(run_id.as_str()));
    let _: () = redis.del("rushee").await.unwrap();

    reset().await;
    register().await;
    let client = redis::Client::open(url).unwrap();
    let mut pubsub = client.get_async_pubsub().await.unwrap();
    pubsub.subscribe("rushee").await.unwrap();
    let mut messages = pubsub.on_message();

    let payload = Json(serde_json::from_value(json!({"gtid": GTID})).unwrap());
    assert_eq!(
        voting::change_rushee(payload).await.unwrap().0,
        json!({"status": "success", "message": "Rushee set and published"})
    );
    let stored: String = redis.get("rushee").await.unwrap();
    let selected: RusheeModel = serde_json::from_str(&stored).unwrap();
    assert_eq!(selected.gtid, GTID);
    let published = tokio::time::timeout(Duration::from_secs(2), messages.next())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(published.get_channel_name(), "rushee");
    assert_eq!(published.get_payload::<String>().unwrap(), stored);

    // The current read endpoint expects a question-plus-rushee wrapper while
    // selection stores the rushee directly; keep this response unchanged.
    assert_eq!(
        voting::get_rushee().await.unwrap_err(),
        StatusCode::INTERNAL_SERVER_ERROR
    );

    // A failed notification currently leaves the selected rushee stored.
    // Restrict publishing only on the marked disposable Redis instance.
    let _: () = redis::cmd("ACL")
        .arg("SETUSER")
        .arg("default")
        .arg("-publish")
        .query_async(&mut redis)
        .await
        .unwrap();
    let payload = Json(serde_json::from_value(json!({"gtid": GTID})).unwrap());
    assert_eq!(
        voting::change_rushee(payload).await.unwrap_err(),
        StatusCode::INTERNAL_SERVER_ERROR
    );
    let retained: String = redis.get("rushee").await.unwrap();
    assert_eq!(
        serde_json::from_str::<RusheeModel>(&retained).unwrap().gtid,
        GTID
    );
    let _: () = redis::cmd("ACL")
        .arg("SETUSER")
        .arg("default")
        .arg("+publish")
        .query_async(&mut redis)
        .await
        .unwrap();

    let _: () = redis.set("rushee", "prior-selection").await.unwrap();
    // Denying SET distinguishes a failed write from the partial write above.
    let _: () = redis::cmd("ACL")
        .arg("SETUSER")
        .arg("default")
        .arg("-set")
        .query_async(&mut redis)
        .await
        .unwrap();
    let payload = Json(serde_json::from_value(json!({"gtid": GTID})).unwrap());
    assert_eq!(
        voting::change_rushee(payload).await.unwrap_err(),
        StatusCode::INTERNAL_SERVER_ERROR
    );
    assert_eq!(
        redis.get::<_, String>("rushee").await.unwrap(),
        "prior-selection"
    );
    let _: () = redis::cmd("ACL")
        .arg("SETUSER")
        .arg("default")
        .arg("+set")
        .query_async(&mut redis)
        .await
        .unwrap();
    let _: () = redis.del("rushee").await.unwrap();
    reset().await;
    println!("selected-rushee MongoDB and Redis success and failure contracts passed");
}
