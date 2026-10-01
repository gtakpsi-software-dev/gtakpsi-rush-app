use crate::controllers::db::get_redis_conn;
use axum::{http::StatusCode, response::Json};
use redis::AsyncCommands;
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Debug, Deserialize)]
pub struct ChangeEligibilityPayload {
    pub gtid: String,
}

pub(super) const INELIGIBLE_BROTHERS: &str = "ineligible_brothers";

pub async fn make_eligible(
    Json(payload): Json<ChangeEligibilityPayload>,
) -> Result<Json<Value>, StatusCode> {
    let mut conn = get_redis_conn().await.as_ref().clone();

    let _: i32 = conn
        .srem(INELIGIBLE_BROTHERS, &payload.gtid)
        .await
        .map_err(|e| {
            println!("Redis SREM error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(json!({
        "status": "success",
        "message": "Removed brother"
    })))
}

pub async fn make_ineligible(
    Json(payload): Json<ChangeEligibilityPayload>,
) -> Result<Json<Value>, StatusCode> {
    let mut conn = get_redis_conn().await.as_ref().clone();

    println!("made Ineligible");

    let _: () = conn
        .sadd(INELIGIBLE_BROTHERS, &payload.gtid)
        .await
        .map_err(|e| {
            println!("Redis SADD error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(json!({
        "status": "success",
        "message": "GTID marked ineligible"
    })))
}

pub async fn get_eligibility() -> Result<Json<Value>, StatusCode> {
    let mut conn = get_redis_conn().await.as_ref().clone();

    let ineligible_ids: Vec<String> = conn.smembers(INELIGIBLE_BROTHERS).await.map_err(|e| {
        println!("Redis SMEMBERS error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(json!({
        "status": "success",
        "ineligible_ids": ineligible_ids
    })))
}
