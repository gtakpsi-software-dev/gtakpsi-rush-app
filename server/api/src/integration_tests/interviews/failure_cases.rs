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

pub(super) async fn check_response_clear_failure() {
    reset().await;
    register().await;
    let original = json!([{"question": "Original", "answer": "Saved"}]);
    assert_eq!(
        rushee::post_pis(path(), Json(serde_json::from_value(original).unwrap()))
            .await
            .unwrap()
            .0["status"],
        "success"
    );

    let database = db::get_mongo_client().await.database("rush-app");
    // Reject clearing the array so a failed first write cannot replace saved answers.
    database
        .run_command(doc! {
            "collMod": "rushees",
            "validator": { "$jsonSchema": {
                "bsonType": "object",
                "properties": { "pis": { "minItems": 1 } }
            } }
        })
        .await
        .unwrap();

    assert_eq!(
        rushee::post_pis(path(), Json(vec![])).await.unwrap().0,
        json!({
            "status": "success",
            "message": "There was an error clearing out the current PIS responses"
        })
    );
    let stored = stored_rushee().await;
    assert_eq!(stored.pis.len(), 1);
    assert_eq!(stored.pis[0].question, "Original");
    assert_eq!(stored.pis[0].answer, "Saved");

    database
        .run_command(doc! { "collMod": "rushees", "validator": {} })
        .await
        .unwrap();
}
