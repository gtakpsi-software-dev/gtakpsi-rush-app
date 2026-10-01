use axum::Json;
use bson::{doc, DateTime};
use serde_json::json;

use super::fixtures::*;
use crate::{
    controllers::{db, rushee},
    models::pis::PISQuestion,
};

pub async fn check_contracts() {
    reset().await;
    register().await;
    for (question, category, order) in [
        ("Fixed", None, 0),
        ("A1", Some("A"), 1),
        ("A2", Some("A"), 1),
        ("B1", Some("B"), 2),
    ] {
        db::get_pis_questions_client()
            .await
            .insert_one(PISQuestion {
                question: question.to_string(),
                question_type: "professional".to_string(),
                order: Some(order),
                category: category.map(str::to_string),
            })
            .await
            .unwrap();
    }
    let future = DateTime::from_millis(DateTime::now().timestamp_millis() + 3_600_000);
    db::get_rushee_client()
        .await
        .update_one(doc! {"gtid": GTID}, doc! {"$set": {"pis_timeslot": future}})
        .await
        .unwrap();
    let hidden = rushee::get_pis_interview_questions(path()).await.unwrap().0;
    assert_eq!(hidden["payload"]["available"], false);
    assert_eq!(hidden["payload"]["questions"].as_array().unwrap().len(), 1);
    assert_eq!(hidden["payload"]["questions"][0]["question"], "Fixed");
    assert_eq!(
        hidden["payload"]["reveal_at"],
        serde_json::to_value(future).unwrap()
    );
    assert!(stored_rushee().await.assigned_pis_questions.is_none());

    db::get_rushee_client()
        .await
        .update_one(
            doc! {"gtid": GTID},
            doc! {"$set": {"pis_timeslot": DateTime::now()}},
        )
        .await
        .unwrap();
    let revealed = rushee::get_pis_interview_questions(path()).await.unwrap().0;
    assert_eq!(revealed["payload"]["available"], true);
    let questions = revealed["payload"]["questions"].as_array().unwrap();
    assert_eq!(questions.len(), 3);
    assert_eq!(questions[0]["question"], "Fixed");
    assert_eq!(questions[1]["category"], "A");
    assert_eq!(questions[2]["category"], "B");
    assert_eq!(
        stored_rushee().await.assigned_pis_questions.unwrap().len(),
        2
    );
    assert_eq!(
        rushee::get_pis_interview_questions(path()).await.unwrap().0,
        revealed
    );

    let pinned = PISQuestion {
        question: "Pinned".to_string(),
        question_type: "professional".to_string(),
        order: Some(-1),
        category: Some("A".to_string()),
    };
    db::get_rushee_client()
        .await
        .update_one(
            doc! {"gtid": GTID},
            doc! {"$set": {"assigned_pis_questions": bson::to_bson(&vec![pinned]).unwrap()}},
        )
        .await
        .unwrap();
    let persisted = rushee::get_pis_interview_questions(path()).await.unwrap().0;
    assert_eq!(persisted["payload"]["available"], true);
    assert_eq!(
        persisted["payload"]["reveal_at"],
        revealed["payload"]["reveal_at"]
    );
    assert_eq!(
        persisted["payload"]["questions"].as_array().unwrap().len(),
        2
    );
    assert_eq!(persisted["payload"]["questions"][0]["question"], "Pinned");
    assert_eq!(persisted["payload"]["questions"][1]["question"], "Fixed");
    assert_eq!(
        stored_rushee().await.assigned_pis_questions.unwrap()[0].question,
        "Pinned"
    );

    let autosave = json!({
        "pis_responses": [{"question": "Fixed", "answer": "Observation"}],
        "brother_a_first_name": " Alex ", "brother_a_last_name": " Brother ",
        "brother_b_first_name": "  ", "brother_b_last_name": ""
    });
    assert_eq!(
        rushee::autosave_pis(path(), Json(serde_json::from_value(autosave).unwrap()))
            .await
            .unwrap()
            .0["status"],
        "success"
    );
    let stored = stored_rushee().await;
    assert_eq!(stored.pis.len(), 1);
    assert_eq!(stored.pis[0].answer, "Observation");
    assert_eq!(stored.pis_signup.first_brother_first_name, "Alex");
    assert_eq!(stored.pis_signup.first_brother_last_name, "Brother");
    assert_eq!(stored.pis_signup.second_brother_first_name, "none");
    assert_eq!(stored.pis_signup.second_brother_last_name, "none");

    let replacement = json!([
        {"question": "First", "answer": "One"},
        {"question": "Second", "answer": "Two"}
    ]);
    assert_eq!(
        rushee::post_pis(path(), Json(serde_json::from_value(replacement).unwrap()))
            .await
            .unwrap()
            .0,
        json!({"status": "success", "message": "succesfully stored rushee's pis"})
    );
    let stored = stored_rushee().await;
    assert_eq!(stored.pis.len(), 2);
    assert_eq!(stored.pis[0].question, "First");
    assert_eq!(stored.pis[1].question, "Second");

    assert_eq!(
        rushee::post_pis(path(), Json(vec![])).await.unwrap().0["status"],
        "success"
    );
    assert!(stored_rushee().await.pis.is_empty());
    println!(
        "PIS reveal, persisted assignment, autosave, and response replacement contracts passed"
    );
}
