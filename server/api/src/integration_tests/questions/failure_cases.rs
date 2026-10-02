use axum::Json;
use bson::doc;
use serde_json::json;

use super::*;

pub(super) async fn check_write_failures() {
    reset().await;
    let database = db::get_mongo_client().await.database("rush-app");
    let collection = db::get_pis_questions_client().await;
    let question = PISQuestion {
        question: "Write failure".to_string(),
        question_type: "professional".to_string(),
        order: Some(1),
        category: Some("allowed".to_string()),
    };

    // Reject the insert to preserve the API error and absence of a partial question.
    database
        .run_command(doc! {
            "collMod": "pis-questions",
            "validator": { "question_type": "personal" }
        })
        .await
        .unwrap();
    assert_eq!(
        admin::add_pis_question(Json(question.clone()))
            .await
            .unwrap()
            .0,
        json!({"status": "error", "message": "failed to add pis question"})
    );
    assert_eq!(collection.count_documents(doc! {}).await.unwrap(), 0);
    database
        .run_command(doc! { "collMod": "pis-questions", "validator": {} })
        .await
        .unwrap();

    collection.insert_one(question).await.unwrap();
    // Reject the category update to pin the response and original stored value.
    database
        .run_command(doc! {
            "collMod": "pis-questions",
            "validator": { "category": "allowed" }
        })
        .await
        .unwrap();
    let update = json!({
        "question": "Write failure", "question_type": "professional",
        "category": "blocked"
    });
    assert_eq!(
        admin::update_pis_question_category(Json(serde_json::from_value(update).unwrap()))
            .await
            .unwrap()
            .0,
        json!({"status": "error", "message": "failed to update pis question category"})
    );
    let stored = collection
        .find_one(doc! { "question": "Write failure" })
        .await
        .unwrap()
        .unwrap();
    assert_eq!(stored.category.as_deref(), Some("allowed"));
    database
        .run_command(doc! { "collMod": "pis-questions", "validator": {} })
        .await
        .unwrap();
}
