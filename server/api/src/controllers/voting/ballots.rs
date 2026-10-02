use super::eligibility::INELIGIBLE_BROTHERS;
use crate::models::rushee::{IncomingRusheeVote, RusheeVote, VoteOption};
use crate::storage::db::get_redis_conn;
use anyhow::{Error, Result};
use axum::{http::StatusCode, response::Json};
use redis::AsyncCommands;
use serde_json::{json, to_string, Value};

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

    let rushee_vote = RusheeVote {
        brother_id: payload.brother_id,
        first_name: payload.first_name,
        last_name: payload.last_name,
        vote,
    };

    let serialized_rushee_vote: String =
        to_string(&rushee_vote).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut conn = get_redis_conn().await.as_ref().clone();

    let key = "vote_log";
    let is_ineligible: bool = conn
        .sismember(INELIGIBLE_BROTHERS, &rushee_vote.brother_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if is_ineligible {
        return Ok(Json(json!({
            "status": "ineligible",
            "message": "Brother is not eligible to vote"
        })));
    }

    // HSETNX prevents concurrent requests from recording two votes for one brother.
    let was_new_vote: bool = conn
        .hset_nx(key, rushee_vote.brother_id.clone(), &serialized_rushee_vote)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !was_new_vote {
        return Ok(Json(json!({
            "status": "duplicate",
            "message": "Brother has already voted"
        })));
    }

    // Publish only after the vote is stored so listeners see committed data.
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
    let conn_arc = get_redis_conn().await;
    let mut conn = conn_arc.as_ref().clone();

    let _: () = conn.del("vote_log").await.map_err(|e| {
        println!("❌ Failed to clear vote_log: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Notify listeners after the log has been cleared.
    let _: () = conn.publish("vote_channel", "cleared").await.map_err(|e| {
        println!("❌ Failed to publish clear notification: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(json!({
        "status": "success",
        "message": "All votes cleared"
    })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vote_values_preserve_case_insensitivity_without_accepting_whitespace() {
        assert!(matches!(map_vote("YES".into()), Ok(VoteOption::Yes)));
        assert!(matches!(map_vote("No".into()), Ok(VoteOption::No)));
        assert!(matches!(
            map_vote("ABSTAIN".into()),
            Ok(VoteOption::Abstain)
        ));
        assert!(map_vote(" yes ".into()).is_err());
        assert!(map_vote("maybe".into()).is_err());
    }

    #[tokio::test]
    async fn invalid_vote_fails_before_requesting_redis() {
        let payload = IncomingRusheeVote {
            brother_id: "123".into(),
            first_name: "Ada".into(),
            last_name: "Lovelace".into(),
            vote: "invalid".into(),
        };

        assert_eq!(
            handle_rushee_vote(Json(payload)).await.unwrap_err(),
            StatusCode::BAD_REQUEST
        );
    }
}
