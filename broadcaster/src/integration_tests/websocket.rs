use super::*;

#[tokio::test]
async fn voting_sockets_preserve_snapshots_live_updates_and_client_lifecycle() {
    // INVARIANT: never write fixtures unless this exact disposable Redis instance is marked.
    let mut conn = guarded_redis().await;
    let _: () = conn.set("rushee", r#"{"id":"first"}"#).await.unwrap();
    let _: i64 = conn.hset("vote_log", "valid", r#"{"choice":"yes"}"#).await.unwrap();
    let _: i64 = conn.hset("vote_log", "invalid", "not json").await.unwrap();

    let server = TestServer::start();
    let mut admin = connect(&format!("{}/admin/17", server.url)).await;
    assert_eq!(receive(&mut admin).await, json!({"type":"vote_update","votes":[{"choice":"yes"}]}));
    assert_eq!(receive(&mut admin).await, json!({"type":"rushee_update","rushee":r#"{"id":"first"}"#}));
    assert_eq!(receive(&mut admin).await, json!({"type":"question_update","question":null}));

    let mut voter = connect(&format!("{}/voter/18", server.url)).await;
    assert_eq!(receive(&mut voter).await, json!({"type":"rushee_update","rushee":r#"{"id":"first"}"#}));
    assert_eq!(receive(&mut voter).await, json!({"type":"question_update","question":null}));
    assert!(server.admins.contains_key(&17));
    assert!(server.voters.contains_key(&18));

    admin_socket::admin_spawn_pubsub_listener(server.admins.clone()).await;
    voter_socket::spawn_pubsub_listener(server.voters.clone()).await;
    wait_for_subscribers(&mut conn).await;

    let _: i64 = conn.publish("question", r#"{"prompt":"new"}"#).await.unwrap();
    let question = json!({"type":"question_update","question":r#"{"prompt":"new"}"#});
    assert_eq!(receive(&mut admin).await, question);
    assert_eq!(receive(&mut voter).await, question);

    let _: i64 = conn.publish("rushee", r#"{"id":"second"}"#).await.unwrap();
    let rushee = json!({"type":"rushee_update","rushee":r#"{"id":"second"}"#});
    assert_eq!(receive(&mut admin).await, rushee);
    assert_eq!(receive(&mut voter).await, rushee);

    let _: i64 = conn.hset("vote_log", "other", r#"{"choice":"no"}"#).await.unwrap();
    let _: i64 = conn.publish("vote_channel", "ignored-payload").await.unwrap();
    let update = receive(&mut admin).await;
    assert_eq!(update["type"], "vote_update");
    let votes = update["votes"].as_array().unwrap();
    assert_eq!(votes.len(), 2);
    assert!(votes.contains(&json!({"choice":"yes"})));
    assert!(votes.contains(&json!({"choice":"no"})));
    assert!(tokio::time::timeout(Duration::from_millis(100), voter.next()).await.is_err());

    admin.close(None).await.unwrap();
    voter.close(None).await.unwrap();
    tokio::time::timeout(Duration::from_secs(2), async {
        while !server.admins.is_empty() || !server.voters.is_empty() {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    }).await.expect("disconnected clients remained registered");
}
