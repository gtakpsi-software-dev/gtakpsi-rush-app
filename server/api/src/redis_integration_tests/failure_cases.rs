use super::*;

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
