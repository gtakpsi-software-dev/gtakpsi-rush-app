use super::*;

// Verify that an unavailable eligibility check prevents recording a vote.
pub(super) async fn assert_eligibility_read_failure(
    redis: &mut redis::aio::ConnectionManager,
    vote: IncomingRusheeVote,
) {
    // Deny this read in the disposable instance to verify that voting stops
    // before any ballot is stored when eligibility cannot be checked.
    let _: () = redis::cmd("ACL")
        .arg("SETUSER")
        .arg("default")
        .arg("-sismember")
        .query_async(&mut *redis)
        .await
        .unwrap();
    assert_eq!(
        voting::handle_rushee_vote(Json(vote)).await.unwrap_err(),
        StatusCode::INTERNAL_SERVER_ERROR
    );
    assert_eq!(redis.hlen::<_, usize>("vote_log").await.unwrap(), 0);
    let _: () = redis::cmd("ACL")
        .arg("SETUSER")
        .arg("default")
        .arg("+sismember")
        .query_async(&mut *redis)
        .await
        .unwrap();
}

// Verify that a rejected atomic vote write leaves no ballot.
pub(super) async fn assert_vote_write_failure(redis: &mut redis::aio::ConnectionManager) {
    // Deny the atomic vote write in the disposable instance. A rejected write
    // must leave no ballot and produce no notification for the failed voter.
    let _: () = redis::cmd("ACL")
        .arg("SETUSER")
        .arg("default")
        .arg("-hsetnx")
        .query_async(&mut *redis)
        .await
        .unwrap();
    let failed_vote = IncomingRusheeVote {
        brother_id: "brother-3".into(),
        first_name: "Katherine".into(),
        last_name: "Johnson".into(),
        vote: "yes".into(),
    };
    assert_eq!(
        voting::handle_rushee_vote(Json(failed_vote))
            .await
            .unwrap_err(),
        StatusCode::INTERNAL_SERVER_ERROR
    );
    assert!(redis
        .hget::<_, _, Option<String>>("vote_log", "brother-3")
        .await
        .unwrap()
        .is_none());
    let _: () = redis::cmd("ACL")
        .arg("SETUSER")
        .arg("default")
        .arg("+hsetnx")
        .query_async(&mut *redis)
        .await
        .unwrap();
}

// Verify selection errors for invalid JSON and denied Redis reads.
pub(super) async fn assert_rushee_read_failures(redis: &mut redis::aio::ConnectionManager) {
    let _: () = redis.set("rushee", "not-json").await.unwrap();
    assert_eq!(
        voting::get_rushee().await.unwrap_err(),
        StatusCode::INTERNAL_SERVER_ERROR
    );
    let _: () = redis.del("rushee").await.unwrap();

    // Deny GET only in the guarded instance to distinguish a failed Redis
    // read from the existing missing-key response.
    let _: () = redis::cmd("ACL")
        .arg("SETUSER")
        .arg("default")
        .arg("-get")
        .query_async(&mut *redis)
        .await
        .unwrap();
    assert_eq!(
        voting::get_rushee().await.unwrap_err(),
        StatusCode::INTERNAL_SERVER_ERROR
    );
    let _: () = redis::cmd("ACL")
        .arg("SETUSER")
        .arg("default")
        .arg("+get")
        .query_async(&mut *redis)
        .await
        .unwrap();
}

// Verify that successful Redis writes remain stored when their notifications fail.
pub(super) async fn assert_publish_failures(redis: &mut redis::aio::ConnectionManager) {
    // Deny publishing only in the guarded instance to characterize writes
    // that succeed before their notification fails.
    let _: () = redis::cmd("ACL")
        .arg("SETUSER")
        .arg("default")
        .arg("-publish")
        .query_async(&mut *redis)
        .await
        .unwrap();
    let failed_vote = IncomingRusheeVote {
        brother_id: "brother-2".into(),
        first_name: "Grace".into(),
        last_name: "Hopper".into(),
        vote: "no".into(),
    };
    assert_eq!(
        voting::handle_rushee_vote(Json(failed_vote))
            .await
            .unwrap_err(),
        StatusCode::INTERNAL_SERVER_ERROR
    );
    let stored: String = redis.hget("vote_log", "brother-2").await.unwrap();
    assert_eq!(
        serde_json::from_str::<Value>(&stored).unwrap()["vote"],
        "No"
    );

    assert_eq!(
        voting::clear_votes().await.unwrap_err(),
        StatusCode::INTERNAL_SERVER_ERROR
    );
    assert_eq!(redis.hlen::<_, usize>("vote_log").await.unwrap(), 0);
    let next_question = json!({"question": "Stored without notification"});
    assert_eq!(
        voting::post_question(Json(serde_json::from_value(next_question).unwrap()))
            .await
            .unwrap_err(),
        StatusCode::INTERNAL_SERVER_ERROR
    );
    assert_eq!(
        redis.get::<_, String>("question").await.unwrap(),
        "Stored without notification"
    );
    let _: () = redis::cmd("ACL")
        .arg("SETUSER")
        .arg("default")
        .arg("+publish")
        .query_async(&mut *redis)
        .await
        .unwrap();
}
