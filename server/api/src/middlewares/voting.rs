use crate::{
    controllers::db, 
    middlewares::rushee::RusheeError, 
    models::rushee::RusheeModel,
    controllers::voting::QuestionAndRushee
};
use std::fmt;
use serde_json::from_str;
use redis::AsyncCommands;

#[derive(Debug)]
pub struct VotingError {
    pub code: String,
    pub message: String,
}

impl fmt::Display for VotingError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for VotingError {}

pub async fn fetch_question() -> Result<String, VotingError> {
    let redis_conn = db::get_redis_conn().await;
    let mut redis = redis_conn.as_ref().clone();

    let response: String = redis
        .get("rushee")
        .await
        .map_err(|_| VotingError {
            code: "QUESTION_NOT_FOUND".to_string(),
            message: "No rushee found with that ID".to_string(),
        })?;

    let parsed: QuestionAndRushee = from_str(&response).map_err(|e| VotingError {
        code: "DESERIALIZATION_ERROR".to_string(),
        message: format!("Failed to parse redis payload: {}", e),
    })?;

    Ok(parsed.question)
}

pub async fn fetch_rushee_from_redis() -> Result<RusheeModel, RusheeError> {
    let redis_conn = db::get_redis_conn().await;
    let mut redis = redis_conn.as_ref().clone();

    let response: String = redis
        .get("rushee")
        .await
        .map_err(|_| RusheeError {
            code: "RUSHEE_NOT_FOUND".to_string(),
            message: "No rushee data found".to_string(),
        })?;

    let parsed: QuestionAndRushee = from_str(&response).map_err(|e| RusheeError {
        code: "DESERIALIZATION_ERROR".to_string(),
        message: format!("Failed to deserialize rushee data: {}", e),
    })?;

    Ok(parsed.rushee)
}
