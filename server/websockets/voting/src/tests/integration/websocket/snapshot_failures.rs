use super::*;

pub(super) async fn assert_failed_reads_keep_sockets_live(
    server: &TestServer,
    conn: &mut redis::aio::Connection,
) {
    // Deny snapshot reads only in the guarded disposable Redis instance.
    // Read failures must omit snapshots without closing either socket role.
    let _: () = redis::cmd("ACL")
        .arg("SETUSER")
        .arg("default")
        .arg("-get")
        .arg("-hvals")
        .query_async(conn)
        .await
        .unwrap();

    let mut admin = connect(&format!("{}/admin/23", server.url)).await;
    let mut voter = connect(&format!("{}/voter/24", server.url)).await;
    tokio::time::timeout(Duration::from_secs(2), async {
        while !server.admins.contains_key(&23) || !server.voters.contains_key(&24) {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .expect("snapshot read failure prevented socket registration");
    assert!(
        tokio::time::timeout(Duration::from_millis(100), admin.next())
            .await
            .is_err()
    );
    assert!(
        tokio::time::timeout(Duration::from_millis(100), voter.next())
            .await
            .is_err()
    );

    let _: () = redis::cmd("ACL")
        .arg("SETUSER")
        .arg("default")
        .arg("+get")
        .arg("+hvals")
        .query_async(conn)
        .await
        .unwrap();
    let _: i64 = conn
        .publish("question", "after-read-failure")
        .await
        .unwrap();
    let update = json!({"type":"question_update","question":"after-read-failure"});
    assert_eq!(receive(&mut admin).await, update);
    assert_eq!(receive(&mut voter).await, update);

    admin.close(None).await.unwrap();
    voter.close(None).await.unwrap();
}
