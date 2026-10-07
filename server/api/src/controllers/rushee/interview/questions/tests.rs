use super::*;

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
