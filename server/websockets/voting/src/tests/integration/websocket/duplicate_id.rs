use super::*;
use futures_util::SinkExt;

// Checks sender replacement and cleanup when two admin sockets share an ID.
pub(super) async fn assert_duplicate_id_behavior(server: &TestServer) {
    let url = format!("{}/admin/42", server.url);

    let mut older = connect(&url).await;
    for expected_type in ["vote_update", "rushee_update", "question_update"] {
        assert_eq!(receive(&mut older).await["type"], expected_type);
    }
    tokio::time::timeout(Duration::from_secs(2), async {
        while !server.admins.contains_key(&42) {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .expect("older connection did not register");
    let old_sender = server.admins.get(&42).unwrap().clone();

    let mut newer = connect(&url).await;
    for expected_type in ["vote_update", "rushee_update", "question_update"] {
        assert_eq!(receive(&mut newer).await["type"], expected_type);
    }
    tokio::time::timeout(Duration::from_secs(2), async {
        while server
            .admins
            .get(&42)
            .is_some_and(|sender| sender.same_channel(&old_sender))
        {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .expect("newer connection did not replace the old broadcast sender");

    older.close(None).await.unwrap();
    tokio::time::timeout(Duration::from_secs(2), async {
        while server.admins.contains_key(&42) {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .expect("older disconnect did not remove the shared ID");

    let ping = vec![4, 2];
    newer.send(Message::Ping(ping.clone())).await.unwrap();
    assert_eq!(receive_frame(&mut newer).await, Message::Pong(ping.clone()));
    assert_eq!(receive_frame(&mut newer).await, Message::Pong(ping));
    newer.close(None).await.unwrap();
}
