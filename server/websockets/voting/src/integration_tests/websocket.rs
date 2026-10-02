use super::*;
use futures_util::SinkExt;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio_tungstenite::tungstenite::Message;

mod duplicate_id;
mod reconnect;

#[tokio::test]
async fn voting_sockets_preserve_snapshots_live_updates_and_client_lifecycle() {
    // INVARIANT: never write fixtures unless this exact disposable Redis instance is marked.
    let mut conn = guarded_redis().await;
    let _: () = conn.set("rushee", r#"{"id":"first"}"#).await.unwrap();
    let _: i64 = conn
        .hset("vote_log", "valid", r#"{"choice":"yes"}"#)
        .await
        .unwrap();
    let _: i64 = conn.hset("vote_log", "invalid", "not json").await.unwrap();

    let server = TestServer::start();
    let mut health = TcpStream::connect(server.url.trim_start_matches("ws://"))
        .await
        .unwrap();
    health
        .write_all(b"GET / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")
        .await
        .unwrap();
    let mut response = Vec::new();
    health.read_to_end(&mut response).await.unwrap();
    assert!(response.starts_with(b"HTTP/1.1 200 OK\r\n"));
    assert!(response.ends_with(b"\r\n\r\nok"));

    let mut admin = connect(&format!("{}/admin/17", server.url)).await;
    assert_eq!(
        receive(&mut admin).await,
        json!({"type":"vote_update","votes":[{"choice":"yes"}]})
    );
    assert_eq!(
        receive(&mut admin).await,
        json!({"type":"rushee_update","rushee":r#"{"id":"first"}"#})
    );
    assert_eq!(
        receive(&mut admin).await,
        json!({"type":"question_update","question":null})
    );

    // Admin and voter connections must remain independent when their route IDs match.
    let mut voter = connect(&format!("{}/voter/17", server.url)).await;
    assert_eq!(
        receive(&mut voter).await,
        json!({"type":"rushee_update","rushee":r#"{"id":"first"}"#})
    );
    assert_eq!(
        receive(&mut voter).await,
        json!({"type":"question_update","question":null})
    );
    assert!(server.admins.contains_key(&17));
    assert!(server.voters.contains_key(&17));

    // Invalid route IDs still receive snapshots and get temporary IDs in each role map.
    let mut unnamed_admin = connect(&format!("{}/admin/unnamed", server.url)).await;
    assert_eq!(receive(&mut unnamed_admin).await["type"], "vote_update");
    assert_eq!(receive(&mut unnamed_admin).await["type"], "rushee_update");
    assert_eq!(receive(&mut unnamed_admin).await["type"], "question_update");
    let mut unnamed_voter = connect(&format!("{}/voter/unnamed", server.url)).await;
    assert_eq!(receive(&mut unnamed_voter).await["type"], "rushee_update");
    assert_eq!(receive(&mut unnamed_voter).await["type"], "question_update");
    assert_eq!(server.admins.len(), 2);
    assert_eq!(server.voters.len(), 2);

    unnamed_admin.close(None).await.unwrap();
    unnamed_voter.close(None).await.unwrap();
    tokio::time::timeout(Duration::from_secs(2), async {
        while server.admins.len() != 1 || server.voters.len() != 1 {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .expect("temporary clients remained registered after disconnect");

    for socket in [&mut admin, &mut voter] {
        socket
            .send(Message::Text("not-json".to_owned()))
            .await
            .unwrap();
        socket
            .send(Message::Binary(vec![0, 159, 255]))
            .await
            .unwrap();
        let payload = vec![1, 2, 3];
        socket.send(Message::Ping(payload.clone())).await.unwrap();
        // Preserve the two Pong frames currently emitted by each session.
        let response = receive_frame(socket).await;
        assert_eq!(response, Message::Pong(payload.clone()));
        let second = receive_frame(socket).await;
        assert_eq!(second, Message::Pong(payload));
    }

    admin_socket::spawn_pubsub_listener(server.admins.clone()).await;
    voter_socket::spawn_pubsub_listener(server.voters.clone()).await;
    wait_for_subscribers(&mut conn).await;

    // Invalid UTF-8 cannot form a client event; a later valid update must still arrive.
    let _: i64 = conn.publish("question", vec![0xffu8, 0xfe]).await.unwrap();
    let _: i64 = conn
        .publish("question", r#"{"prompt":"new"}"#)
        .await
        .unwrap();
    let question = json!({"type":"question_update","question":r#"{"prompt":"new"}"#});
    assert_eq!(receive(&mut admin).await, question);
    assert_eq!(receive(&mut voter).await, question);

    let _: i64 = conn.publish("rushee", r#"{"id":"second"}"#).await.unwrap();
    let rushee = json!({"type":"rushee_update","rushee":r#"{"id":"second"}"#});
    assert_eq!(receive(&mut admin).await, rushee);
    assert_eq!(receive(&mut voter).await, rushee);

    let _: i64 = conn
        .hset("vote_log", "other", r#"{"choice":"no"}"#)
        .await
        .unwrap();
    let _: i64 = conn
        .publish("vote_channel", "ignored-payload")
        .await
        .unwrap();
    let update = receive(&mut admin).await;
    assert_eq!(update["type"], "vote_update");
    let votes = update["votes"].as_array().unwrap();
    assert_eq!(votes.len(), 2);
    assert!(votes.contains(&json!({"choice":"yes"})));
    assert!(votes.contains(&json!({"choice":"no"})));
    assert!(
        tokio::time::timeout(Duration::from_millis(100), voter.next())
            .await
            .is_err()
    );

    let _: i64 = conn.del("rushee").await.unwrap();
    let _: () = conn.set("question", r#"{"prompt":"saved"}"#).await.unwrap();
    let mut later_admin = connect(&format!("{}/admin/19", server.url)).await;
    assert_eq!(receive(&mut later_admin).await["type"], "vote_update");
    assert_eq!(
        receive(&mut later_admin).await,
        json!({"type":"rushee_update","rushee":null})
    );
    assert_eq!(
        receive(&mut later_admin).await,
        json!({"type":"question_update","question":r#"{"prompt":"saved"}"#})
    );
    let mut later_voter = connect(&format!("{}/voter/20", server.url)).await;
    assert_eq!(
        receive(&mut later_voter).await,
        json!({"type":"rushee_update","rushee":null})
    );
    assert_eq!(
        receive(&mut later_voter).await,
        json!({"type":"question_update","question":r#"{"prompt":"saved"}"#})
    );

    admin.close(None).await.unwrap();
    voter.close(None).await.unwrap();
    later_admin.close(None).await.unwrap();
    later_voter.close(None).await.unwrap();
    reconnect::assert_reconnects(&server, &mut conn).await;
    duplicate_id::assert_duplicate_id_behavior(&server).await;
}
