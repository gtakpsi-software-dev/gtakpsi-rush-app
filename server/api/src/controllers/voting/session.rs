use crate::controllers::db::get_redis_conn;
use crate::middlewares::attendance;
use crate::middlewares::rush_nights::enrich_interactions_by_night;
use crate::models::rushee::RusheeModel;
use crate::services::rushee_lookup::fetch_rushee;
use axum::{http::StatusCode, response::Json};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use serde_json::{from_str, json, to_string, Value};

#[derive(Debug, Deserialize)]
pub struct ChangeRusheePayload {
    pub gtid: String,
}

#[derive(Debug, Deserialize)]
pub struct PostQuestionPayload {
    pub question: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QuestionAndRushee {
    pub question: String,
    pub rushee: RusheeModel,
}

pub async fn change_rushee(
    Json(payload): Json<ChangeRusheePayload>,
) -> Result<Json<Value>, StatusCode> {
    let rushee_result = fetch_rushee(payload.gtid).await;

    match rushee_result {
        Ok(mut rushee) => {
            if let Ok(rush_nights) = attendance::get_rush_nights_sorted().await {
                enrich_interactions_by_night(&mut rushee, &rush_nights);
            }
            let mut redis = get_redis_conn().await.as_ref().clone();

            let serialized_rushee = to_string(&rushee).map_err(|e| {
                println!("Failed to serialize rushee: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

            let _: () = redis.set("rushee", &serialized_rushee).await.map_err(|e| {
                println!("Failed to set Redis key 'rushee': {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

            // Publish after storing so subscribers can read the newly selected rushee.
            let _: () = redis
                .publish("rushee", &serialized_rushee)
                .await
                .map_err(|e| {
                    println!("Failed to publish to Redis channel 'rushee': {:?}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;

            Ok(Json(json!({
                "status": "success",
                "message": "Rushee set and published"
            })))
        }

        Err(e) => {
            println!("Rushee not found: {:?}", e);
            Err(StatusCode::NOT_FOUND)
        }
    }
}

pub async fn get_rushee() -> Result<Json<Value>, StatusCode> {
    let redis_conn = get_redis_conn().await;
    let mut redis = redis_conn.as_ref().clone();

    let raw: Option<String> = redis
        .get("rushee")
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match raw {
        Some(data) => {
            let deserialized: QuestionAndRushee =
                from_str(&data).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            Ok(Json(json!({
                "status": "success",
                "rushee": deserialized
            })))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn post_question(
    Json(payload): Json<PostQuestionPayload>,
) -> Result<Json<Value>, StatusCode> {
    let mut redis = get_redis_conn().await.as_ref().clone();

    let _: () = redis
        .set("question", &payload.question)
        .await
        .map_err(|e| {
            println!("❌ Failed to set Redis key 'question': {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Keep the stored question ahead of its notification for listeners that refetch.
    let _: () = redis
        .publish("question", &payload.question)
        .await
        .map_err(|e| {
            println!("❌ Failed to publish to Redis channel 'question': {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(json!({
        "status": "success",
        "message": "Question set and published"
    })))
}
