use super::*;

// Verify compatibility with questions that omit category and display order.
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

// Verify that an empty category string differs from an absent category.
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

// Verify exact question identity matching, including surrounding whitespace.
#[test]
fn question_identity_uses_exact_question_and_type_in_both_mutations() {
    assert_eq!(
        question_identity_filter(" Describe a project ", "professional"),
        doc! {"$and": [
            doc! {"question": " Describe a project "},
            doc! {"question_type": "professional"}
        ]}
    );
}

// Verify status and message fields in question responses.
#[test]
fn question_messages_keep_the_existing_json_contract() {
    let Json(body) = question_message("error", "no matching pis question found");
    assert_eq!(
        body,
        json!({"status": "error", "message": "no matching pis question found"})
    );
}
