use super::*;

#[test]
fn averaging_accepts_the_closed_one_to_five_range_including_fractional_values() {
    for value in [1.0, 1.5, 3.0, 5.0] {
        assert!(is_modern_rating_value(value));
    }
    for value in [
        -1.0,
        0.0,
        0.99,
        5.01,
        f32::NAN,
        f32::INFINITY,
        f32::NEG_INFINITY,
    ] {
        assert!(!is_modern_rating_value(value));
    }
}

#[test]
fn question_sorting_keeps_equal_orders_stable_and_missing_orders_last() {
    let mut questions: Vec<PISQuestion> = [
        ("Unordered", None),
        ("Second A", Some(2)),
        ("First", Some(-1)),
        ("Second B", Some(2)),
        ("Explicit max", Some(i32::MAX)),
    ]
    .into_iter()
    .map(|(question, order)| PISQuestion {
        question: question.to_string(),
        question_type: "professional".to_string(),
        order,
        category: None,
    })
    .collect();
    sort_pis_questions(&mut questions);
    assert_eq!(
        questions
            .iter()
            .map(|question| question.question.as_str())
            .collect::<Vec<_>>(),
        ["First", "Second A", "Second B", "Unordered", "Explicit max"]
    );
}

#[test]
fn autosave_payload_keeps_field_names_and_requires_all_brother_names() {
    let value = json!({
        "pis_responses": [{"question": "Question", "answer": "Answer"}],
        "brother_a_first_name": " Alex ", "brother_a_last_name": "Brother",
        "brother_b_first_name": "", "brother_b_last_name": ""
    });
    let payload: PISAutosavePayload = serde_json::from_value(value.clone()).unwrap();
    assert_eq!(serde_json::to_value(payload).unwrap(), value);
    let mut incomplete = value;
    incomplete
        .as_object_mut()
        .unwrap()
        .remove("brother_b_last_name");
    assert!(serde_json::from_value::<PISAutosavePayload>(incomplete).is_err());
}

#[test]
fn self_service_query_distinguishes_missing_empty_and_supplied_codes() {
    for (query, expected) in [
        (json!({}), None),
        (json!({"code": ""}), Some("")),
        (json!({"code": "provided"}), Some("provided")),
    ] {
        let params: SelfViewParams = serde_json::from_value(query).unwrap();
        assert_eq!(params.code.as_deref(), expected);
    }
}
