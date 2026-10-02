use super::*;

pub(super) async fn check_second_response_write_failure() {
    reset().await;
    register().await;
    let database = db::get_mongo_client().await.database("rush-app");

    // Permit the first response but reject the second to pin the existing partial write.
    database
        .run_command(doc! {
            "collMod": "rushees",
            "validator": { "$jsonSchema": {
                "bsonType": "object",
                "properties": { "pis": { "maxItems": 1 } }
            } }
        })
        .await
        .unwrap();

    let responses = json!([
        {"question": "First", "answer": "One"},
        {"question": "Second", "answer": "Two"}
    ]);
    assert_eq!(
        rushee::post_pis(path(), Json(serde_json::from_value(responses).unwrap()))
            .await
            .unwrap()
            .0,
        json!({"status": "error", "message": "failed to push a pis response"})
    );
    let stored = stored_rushee().await;
    assert_eq!(stored.pis.len(), 1);
    assert_eq!(stored.pis[0].question, "First");
    assert_eq!(stored.pis[0].answer, "One");

    database
        .run_command(doc! { "collMod": "rushees", "validator": {} })
        .await
        .unwrap();
}
