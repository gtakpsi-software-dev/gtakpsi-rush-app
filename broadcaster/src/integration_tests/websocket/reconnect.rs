use super::*;

async fn wait_for_client_cleanup(server: &TestServer) {
    tokio::time::timeout(Duration::from_secs(2), async {
        while !server.admins.is_empty() || !server.voters.is_empty() {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .expect("disconnected clients remained registered");
}

pub(super) async fn assert_reconnects(server: &TestServer, conn: &mut redis::aio::Connection) {
    // Wait for the old ID to leave the broadcast map before reconnecting with it.
    wait_for_client_cleanup(server).await;

    let mut reconnected_admin = connect(&format!("{}/admin/17", server.url)).await;
    assert_eq!(receive(&mut reconnected_admin).await["type"], "vote_update");
    assert_eq!(
        receive(&mut reconnected_admin).await,
        json!({"type":"rushee_update","rushee":null})
    );
    assert_eq!(
        receive(&mut reconnected_admin).await,
        json!({"type":"question_update","question":r#"{"prompt":"saved"}"#})
    );

    let mut reconnected_voter = connect(&format!("{}/voter/17", server.url)).await;
    assert_eq!(
        receive(&mut reconnected_voter).await,
        json!({"type":"rushee_update","rushee":null})
    );
    assert_eq!(
        receive(&mut reconnected_voter).await,
        json!({"type":"question_update","question":r#"{"prompt":"saved"}"#})
    );
    assert!(server.admins.contains_key(&17));
    assert!(server.voters.contains_key(&17));

    let _: i64 = conn
        .publish("question", r#"{"prompt":"after-reconnect"}"#)
        .await
        .unwrap();
    let question = json!({"type":"question_update","question":r#"{"prompt":"after-reconnect"}"#});
    assert_eq!(receive(&mut reconnected_admin).await, question);
    assert_eq!(receive(&mut reconnected_voter).await, question);

    reconnected_admin.close(None).await.unwrap();
    reconnected_voter.close(None).await.unwrap();
    wait_for_client_cleanup(server).await;
}
