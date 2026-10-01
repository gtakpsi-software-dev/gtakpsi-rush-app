use axum::{http::StatusCode, Json};
use futures::StreamExt;
use redis::AsyncCommands;
use serde_json::{json, Value};
use std::{env, time::Duration};

use crate::{
    controllers::{db, voting},
    models::rushee::IncomingRusheeVote,
};

#[tokio::test]
async fn voting_redis_contracts() {
    let port = env::var("RUSH_TEST_REDIS_PORT").expect("Run scripts/testing/voting-integration.py");
    let run_id = env::var("RUSH_TEST_REDIS_RUN_ID").expect("Missing isolated Redis run ID");
    assert_eq!(
        env::var("REDIS_URL").unwrap(),
        format!("redis://127.0.0.1:{port}")
    );

    let connection = db::get_redis_conn().await;
    let mut redis = connection.as_ref().clone();
    let guard: Option<String> = redis.get("_rush_voting_integration_guard").await.unwrap();
    // INVARIANT: clear voting keys only in the marked disposable Redis instance.
    assert_eq!(guard.as_deref(), Some(run_id.as_str()));
    let _: () = redis
        .del(&["ineligible_brothers", "vote_log", "question"])
        .await
        .unwrap();
    let client = redis::Client::open(env::var("REDIS_URL").unwrap()).unwrap();
    let mut pubsub = client.get_async_pubsub().await.unwrap();
    pubsub.subscribe("vote_channel").await.unwrap();
    pubsub.subscribe("question").await.unwrap();
    let mut messages = pubsub.on_message();

    let identity = json!({"gtid": "brother-1"});
    let vote = || IncomingRusheeVote {
        brother_id: "brother-1".into(),
        first_name: "Ada".into(),
        last_name: "Lovelace".into(),
        vote: "YES".into(),
    };

    assert_eq!(
        voting::make_ineligible(Json(serde_json::from_value(identity.clone()).unwrap()))
            .await
            .unwrap()
            .0["status"],
        "success"
    );
    assert_eq!(
        voting::get_eligibility().await.unwrap().0["ineligible_ids"],
        json!(["brother-1"])
    );
    assert_eq!(
        voting::handle_rushee_vote(Json(vote())).await.unwrap().0["status"],
        "ineligible"
    );
    let stored: Option<String> = redis.hget("vote_log", "brother-1").await.unwrap();
    assert!(stored.is_none());

    assert_eq!(
        voting::make_eligible(Json(serde_json::from_value(identity).unwrap()))
            .await
            .unwrap()
            .0["status"],
        "success"
    );
    assert_eq!(
        voting::handle_rushee_vote(Json(vote())).await.unwrap().0["status"],
        "success"
    );
    assert_eq!(
        voting::handle_rushee_vote(Json(vote())).await.unwrap().0["status"],
        "duplicate"
    );
    let stored: String = redis.hget("vote_log", "brother-1").await.unwrap();
    let stored: Value = serde_json::from_str(&stored).unwrap();
    assert_eq!(stored["vote"], "Yes");
    assert_eq!(stored["first_name"], "Ada");
    let published_vote = tokio::time::timeout(Duration::from_secs(2), messages.next())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(published_vote.get_channel_name(), "vote_channel");
    let published_vote: Value =
        serde_json::from_str(&published_vote.get_payload::<String>().unwrap()).unwrap();
    assert_eq!(published_vote, stored);

    assert_eq!(voting::clear_votes().await.unwrap().0["status"], "success");
    let cleared = tokio::time::timeout(Duration::from_secs(2), messages.next())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(cleared.get_channel_name(), "vote_channel");
    assert_eq!(cleared.get_payload::<String>().unwrap(), "cleared");
    let remaining: usize = redis.hlen("vote_log").await.unwrap();
    assert_eq!(remaining, 0);

    assert_eq!(
        voting::get_rushee().await.unwrap_err(),
        StatusCode::NOT_FOUND
    );
    let question = json!({"question": "Next question"});
    assert_eq!(
        voting::post_question(Json(serde_json::from_value(question).unwrap()))
            .await
            .unwrap()
            .0["status"],
        "success"
    );
    let stored_question: String = redis.get("question").await.unwrap();
    assert_eq!(stored_question, "Next question");
    let published_question = tokio::time::timeout(Duration::from_secs(2), messages.next())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(published_question.get_channel_name(), "question");
    assert_eq!(
        published_question.get_payload::<String>().unwrap(),
        stored_question
    );
}
