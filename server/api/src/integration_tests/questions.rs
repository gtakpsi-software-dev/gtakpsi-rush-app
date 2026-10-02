use axum::Json;
use bson::doc;
use serde_json::json;

use super::fixtures::reset;
use crate::{controllers::admin, models::pis::PISQuestion, storage::db};

mod failure_cases;

pub async fn check_contracts() {
    reset().await;

    let question = PISQuestion {
        question: "Describe a project".to_string(),
        question_type: "professional".to_string(),
        order: Some(4),
        category: None,
    };
    let other_type = PISQuestion {
        question_type: "personal".to_string(),
        ..question.clone()
    };
    for entry in [question.clone(), other_type] {
        let result = admin::add_pis_question(Json(entry)).await.unwrap().0;
        assert_eq!(
            result,
            json!({
                "status": "success", "message": "successfully added pis question"
            })
        );
    }

    let listed = admin::get_pis_questions().await.unwrap().0;
    assert_eq!(listed["status"], "success");
    assert_eq!(listed["payload"].as_array().unwrap().len(), 2);

    let collection = db::get_mongo_client()
        .await
        .database("rush-app")
        .collection::<bson::Document>("pis-questions");
    // The admin listing rejects a malformed stored question instead of returning a partial list.
    let malformed = collection
        .insert_one(doc! {
            "question": "Invalid", "question_type": "professional", "order": "not-a-number"
        })
        .await
        .unwrap();
    assert_eq!(
        admin::get_pis_questions().await.unwrap().0,
        json!({"status": "error", "message": "some error occurred"})
    );
    collection
        .delete_one(doc! {"_id": malformed.inserted_id})
        .await
        .unwrap();

    let update = json!({
        "question": "Describe a project", "question_type": "professional",
        "category": "leadership"
    });
    let result = admin::update_pis_question_category(Json(serde_json::from_value(update).unwrap()))
        .await
        .unwrap()
        .0;
    assert_eq!(
        result["message"],
        "successfully updated pis question category"
    );

    let professional = collection
        .find_one(doc! {"question": "Describe a project", "question_type": "professional"})
        .await
        .unwrap()
        .unwrap();
    let personal = collection
        .find_one(doc! {"question": "Describe a project", "question_type": "personal"})
        .await
        .unwrap()
        .unwrap();
    assert_eq!(professional.get_str("category").unwrap(), "leadership");
    assert_eq!(personal.get("category"), Some(&bson::Bson::Null));

    let clear = json!({
        "question": "Describe a project", "question_type": "professional",
        "category": null
    });
    let result = admin::update_pis_question_category(Json(serde_json::from_value(clear).unwrap()))
        .await
        .unwrap()
        .0;
    assert_eq!(result["status"], "success");
    let cleared = collection
        .find_one(doc! {"question": "Describe a project", "question_type": "professional"})
        .await
        .unwrap()
        .unwrap();
    assert!(!cleared.contains_key("category"));

    let missing = json!({
        "question": "Unknown", "question_type": "professional", "category": "leadership"
    });
    let result =
        admin::update_pis_question_category(Json(serde_json::from_value(missing).unwrap()))
            .await
            .unwrap()
            .0;
    assert_eq!(
        result,
        json!({
            "status": "error", "message": "no matching pis question found"
        })
    );

    let result = admin::delete_pis_question(Json(question.clone()))
        .await
        .unwrap()
        .0;
    assert_eq!(
        result,
        json!({
            "status": "success", "message": "successfully deleted PIS question"
        })
    );
    assert_eq!(collection.count_documents(doc! {}).await.unwrap(), 1);

    // The endpoint acknowledges a repeated deletion even when no document matches.
    assert_eq!(
        admin::delete_pis_question(Json(question)).await.unwrap().0,
        json!({
            "status": "success", "message": "successfully deleted PIS question"
        })
    );
    assert_eq!(collection.count_documents(doc! {}).await.unwrap(), 1);

    let remaining = admin::get_pis_questions().await.unwrap().0;
    assert_eq!(remaining["payload"][0]["question_type"], "personal");

    failure_cases::check_write_failures().await;
}
