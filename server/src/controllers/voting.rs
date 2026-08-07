use crate::middlewares::rushee;
use crate::models::Rushee::{IncomingRusheeVote, RusheeVote, VoteOption};
use anyhow::{Error, Result};
use axum::{
    extract::Path,
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::{get, post},
    Router,
};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use serde_json::{json, to_string, Value};
use std::sync::Arc;

use super::db::get_redis_conn;
use crate::middlewares::attendance;
use crate::middlewares::rushee::fetch_rushee;
use crate::middlewares::voting::{fetch_question, fetch_rushee_from_redis};
use crate::middlewares::rush_nights::enrich_interactions_by_night;
use crate::models::Rushee::RusheeModel;

use serde_json::from_str;

#[derive(Debug, Deserialize)]
pub struct ChangeRusheePayload {
    pub gtid: String,
}

#[derive(Debug, Deserialize)]
pub struct ChangeElibigilityPayload {
    pub gtid: String,
}

#[derive(Debug, Deserialize)]
pub struct GetElibilityPayload {
    pub ids: Vec<String>,
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

const INEGLIBLE_BROTHERS: &str = "ineligible_brothers";
const PLACEHOLDER_QUESTION: &str = "NO_QUESTION";

/**
 * Posts a rushee to the Redis DB
 * @route
 * @param
 * @returns
 */
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

            // Serialize and store rushee under its own key
            let serialized_rushee = to_string(&rushee).map_err(|e| {
                println!("Failed to serialize rushee: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

            let _: () = redis.set("rushee", &serialized_rushee).await.map_err(|e| {
                println!("Failed to set Redis key 'rushee': {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

            // Publish just the rushee to the "rushee" channel
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

    // Attempt to get the "rushee" key from Redis
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

/**
 * Helper function to map a vote to the proper enum
 * @param vote
 */
fn map_vote(vote: String) -> Result<VoteOption, Error> {
    match vote.to_lowercase().as_str() {
        "yes" => Ok(VoteOption::Yes),
        "no" => Ok(VoteOption::No),
        "abstain" => Ok(VoteOption::Abstain),
        _ => Err(Error::msg("Invalid vote option")),
    }
}

pub async fn handle_rushee_vote(
    Json(payload): Json<IncomingRusheeVote>,
) -> Result<Json<Value>, StatusCode> {
    let vote: VoteOption = map_vote(payload.vote.clone()).map_err(|_| StatusCode::BAD_REQUEST)?;

    let rusheeVote = RusheeVote {
        brother_id: payload.brother_id,
        first_name: payload.first_name,
        last_name: payload.last_name,
        vote: vote,
    };

    let serialized_rushee_vote: String =
        to_string(&rusheeVote).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Push to Redis first, then publish notification!
    let mut conn = get_redis_conn().await.as_ref().clone();

    // Check if brother is in the ineligible voters first
    let key = "vote_log";
    let is_ineligible: bool = conn
        .sismember(INEGLIBLE_BROTHERS, &rusheeVote.brother_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if is_ineligible {
        return Ok(Json(json!({
            "status": "ineligible",
            "message": "Brother is not eligible to vote"
        })));
    }

    // Use HSETNX for atomic check-and-set (fixes race condition)
    // Returns true if the field was set (new vote), false if it already existed
    let was_new_vote: bool = conn
        .hset_nx(key, rusheeVote.brother_id.clone(), &serialized_rushee_vote)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !was_new_vote {
        return Ok(Json(json!({
            "status": "duplicate",
            "message": "Brother has already voted"
        })));
    }

    // Publish update to notify listeners (include vote data to avoid refetching)
    let _: () = conn
        .publish("vote_channel", &serialized_rushee_vote)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({
        "status": "success",
        "message": "Vote recorded"
    })))
}

pub async fn clear_votes() -> Result<Json<Value>, StatusCode> {
    // Grab a live Redis connection
    let conn_arc = get_redis_conn().await;
    let mut conn = conn_arc.as_ref().clone();

    // 1) Delete the entire vote_log hash
    let _: () = conn.del("vote_log").await.map_err(|e| {
        println!("❌ Failed to clear vote_log: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 2) Publish a notification so everyone knows votes have been reset
    let _: () = conn.publish("vote_channel", "cleared").await.map_err(|e| {
        println!("❌ Failed to publish clear notification: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // 3) Return success
    Ok(Json(json!({
        "status": "success",
        "message": "All votes cleared"
    })))
}

pub async fn make_eligible(
    Json(payload): Json<ChangeElibigilityPayload>,
) -> Result<Json<Value>, StatusCode> {
    let mut conn = get_redis_conn().await.as_ref().clone();

    let removed: i32 = conn
        .srem(INEGLIBLE_BROTHERS, &payload.gtid)
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
    Json(payload): Json<ChangeElibigilityPayload>,
) -> Result<Json<Value>, StatusCode> {
    let mut conn = get_redis_conn().await.as_ref().clone();

    println!("made Ineligible");

    let _: () = conn
        .sadd(INEGLIBLE_BROTHERS, &payload.gtid)
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

pub async fn get_elibibility() -> Result<Json<Value>, StatusCode> {
    let mut conn = get_redis_conn().await.as_ref().clone();

    let ineligible_ids: Vec<String> = conn.smembers(INEGLIBLE_BROTHERS).await.map_err(|e| {
        println!("Redis SMEMBERS error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(json!({
        "status": "success",
        "ineligible_ids": ineligible_ids
    })))
}

pub async fn post_question(
    Json(payload): Json<PostQuestionPayload>,
) -> Result<Json<Value>, StatusCode> {
    let mut redis = get_redis_conn().await.as_ref().clone();

    // Save the question under its own key
    let _: () = redis
        .set("question", &payload.question)
        .await
        .map_err(|e| {
            println!("❌ Failed to set Redis key 'question': {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Publish just the question to the "question" channel
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
