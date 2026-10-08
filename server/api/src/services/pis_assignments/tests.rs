use super::*;
use crate::models::pis::PISSignup;
use bson::DateTime;

// Build a signup fixture with two specified interviewer slots.
fn signup(first: (&str, &str), second: (&str, &str)) -> PISSignup {
    PISSignup {
        time: DateTime::from_millis(0),
        rushee_first_name: String::new(),
        rushee_last_name: String::new(),
        rushee_gtid: String::new(),
        first_brother_first_name: first.0.into(),
        first_brother_last_name: first.1.into(),
        second_brother_first_name: second.0.into(),
        second_brother_last_name: second.1.into(),
        flex_window: false,
    }
}

// Provide two named interviewers for assignment tests.
fn brothers() -> Vec<BrotherName> {
    vec![
        ("Ada".into(), "Lovelace".into()),
        ("Grace".into(), "Hopper".into()),
    ]
}

// Verify name trimming, blank-name filtering, and availability order.
#[test]
fn availability_preserves_submission_order_and_skips_blank_names() {
    let make = |first: &str, last: &str, slots: Vec<i64>| BrotherPISAvailability {
        brother_uid: String::new(),
        brother_email: String::new(),
        brother_first_name: first.into(),
        brother_last_name: last.into(),
        available_timeslots: slots.into_iter().map(DateTime::from_millis).collect(),
        submitted_at: DateTime::from_millis(0),
    };
    let indexed = index_availability(&[
        make(" Ada ", " Lovelace ", vec![1, 2]),
        make(" ", "Ignored", vec![1]),
        make("Grace", "Hopper", vec![1]),
        make(" Ada ", " Lovelace ", vec![1]),
    ]);

    assert_eq!(
        indexed.get(&1).unwrap(),
        &vec![
            brothers()[0].clone(),
            brothers()[1].clone(),
            brothers()[0].clone()
        ]
    );
    assert_eq!(indexed.get(&2).unwrap(), &vec![brothers()[0].clone()]);
}

// Verify workload balancing and prevention of repeated timeslot assignments.
#[test]
fn planning_balances_load_and_reserves_brothers_per_timeslot() {
    let mut planner = AssignmentPlanner::default();
    planner.register_existing(1, &signup(("Ada", "Lovelace"), ("none", "none")));

    let first = planner.plan(2, &signup(("none", "none"), ("none", "none")), &brothers());
    assert_eq!(first.first, Some(("Grace".into(), "Hopper".into())));
    assert_eq!(first.second, Some(("Ada".into(), "Lovelace".into())));
    assert!(!first.still_missing_first && !first.still_missing_second);

    let next = planner.plan(2, &signup(("none", "none"), ("none", "none")), &brothers());
    assert!(next.first.is_none() && next.second.is_none());
    assert!(next.still_missing_first && next.still_missing_second);
}

// Verify that occupied interviewers are excluded and unfilled slots remain marked missing.
#[test]
fn existing_assignments_block_conflicts_and_keep_partial_failure() {
    let mut planner = AssignmentPlanner::default();
    planner.register_existing(1, &signup((" Ada ", " Lovelace "), ("none", "none")));
    let plan = planner.plan(1, &signup(("none", "none"), ("none", "none")), &brothers());

    assert_eq!(plan.first, Some(("Grace".into(), "Hopper".into())));
    assert_eq!(plan.second, None);
    assert!(!plan.still_missing_first && plan.still_missing_second);
}

// Verify selection of a distinct second interviewer in availability order.
#[test]
fn second_only_assignment_excludes_existing_first_and_uses_tie_order() {
    let mut planner = AssignmentPlanner::default();
    let available = vec![
        ("Ada".into(), "Lovelace".into()),
        ("Grace".into(), "Hopper".into()),
        ("Katherine".into(), "Johnson".into()),
    ];
    let plan = planner.plan(
        1,
        &signup((" Ada ", " Lovelace "), ("none", "none")),
        &available,
    );

    assert_eq!(plan.first, None);
    assert_eq!(plan.second, Some(("Grace".into(), "Hopper".into())));
    assert!(!plan.still_missing_first && !plan.still_missing_second);
}

// Verify that duplicate availability entries do not create duplicate assignments.
#[test]
fn duplicate_availability_cannot_assign_one_brother_twice_in_a_slot() {
    let mut planner = AssignmentPlanner::default();
    let available = vec![
        brothers()[0].clone(),
        brothers()[0].clone(),
        brothers()[1].clone(),
    ];
    let plan = planner.plan(1, &signup(("none", "none"), ("none", "none")), &available);

    assert_eq!(plan.first, Some(("Ada".into(), "Lovelace".into())));
    assert_eq!(plan.second, Some(("Grace".into(), "Hopper".into())));
    assert!(!plan.still_missing_first && !plan.still_missing_second);
    let next = planner.plan(1, &signup(("none", "none"), ("none", "none")), &available);
    assert!(next.first.is_none() && next.second.is_none());
}

// Verify duplicate detection when interviewer names contain surrounding whitespace.
#[test]
fn second_choice_excludes_trimmed_first_even_when_availability_is_not_normalized() {
    let mut planner = AssignmentPlanner::default();
    let available = vec![(" Ada ".into(), " Lovelace ".into()), brothers()[0].clone()];
    let plan = planner.plan(1, &signup(("none", "none"), ("none", "none")), &available);

    assert_eq!(plan.first, Some((" Ada ".into(), " Lovelace ".into())));
    assert_eq!(plan.second, None);
    assert!(!plan.still_missing_first && plan.still_missing_second);
}

// Verify stable tie selection as interviewer workloads change.
#[test]
fn least_assigned_choice_keeps_availability_order_for_ties() {
    let mut planner = AssignmentPlanner::default();
    planner.register_existing(99, &signup(("Ada", "Lovelace"), ("none", "none")));
    let available = vec![
        ("Ada".into(), "Lovelace".into()),
        ("Grace".into(), "Hopper".into()),
        ("Katherine".into(), "Johnson".into()),
    ];

    let first = planner.plan(
        1,
        &signup(("none", "none"), ("Ada", "Lovelace")),
        &available,
    );
    assert_eq!(first.first, Some(("Grace".into(), "Hopper".into())));
    assert_eq!(first.second, None);

    let next = planner.plan(
        2,
        &signup(("none", "none"), ("Ada", "Lovelace")),
        &available,
    );
    assert_eq!(next.first, Some(("Katherine".into(), "Johnson".into())));
}
