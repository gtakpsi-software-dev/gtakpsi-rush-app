use super::*;

#[test]
fn existing_questions_can_omit_category_and_order() {
    let question: PISQuestion = serde_json::from_value(json!({
        "question": "Describe a project", "question_type": "professional"
    }))
    .unwrap();
    assert!(question.order.is_none());
    assert!(question.category.is_none());
    assert_eq!(
        serde_json::to_value(question).unwrap(),
        json!({
            "question": "Describe a project", "question_type": "professional",
            "order": null, "category": null
        })
    );
}

#[test]
fn category_updates_distinguish_empty_category_from_clearing_it() {
    for (category, expected) in [
        (json!(null), None),
        (json!(""), Some("")),
        (json!("leadership"), Some("leadership")),
    ] {
        let payload: UpdatePisQuestionCategoryPayload = serde_json::from_value(json!({
            "question": "Describe a project", "question_type": "professional", "category": category
        }))
        .unwrap();
        assert_eq!(payload.category.as_deref(), expected);
    }
}
