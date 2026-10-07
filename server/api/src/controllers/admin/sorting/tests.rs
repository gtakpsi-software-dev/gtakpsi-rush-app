use super::*;
use serde_json::json;

#[test]
fn sorting_updates_require_the_existing_camel_case_request_fields() {
    let payload: UpdateSortingPayload = serde_json::from_value(json!({
        "sortingStatus": "IN_CLOUD", "sortingOrder": -2
    }))
    .unwrap();
    assert_eq!(payload.sorting_status, "IN_CLOUD");
    assert_eq!(payload.sorting_order, -2);
    assert!(serde_json::from_value::<UpdateSortingPayload>(json!({
        "sorting_status": "IN_CLOUD", "sorting_order": -2
    }))
    .is_err());
}

#[test]
fn sorting_statuses_are_case_sensitive_and_reject_unknown_columns() {
    for status in [
        "UNSORTED",
        "IN_CLOUD",
        "MID_CLOUD",
        "OUT_CLOUD",
        "DISCUSSED",
        "INELIGIBLE",
    ] {
        assert!(validate_status(status));
    }
    for status in ["", "unsorted", "IN CLOUD", "UNSORTED ", "ACCEPTED"] {
        assert!(!validate_status(status));
    }
}

#[test]
fn sorting_summary_keeps_existing_camel_case_wire_fields() {
    let rushee = SortingRushee {
        id: "900000001".to_string(),
        full_name: "Test Rushee".to_string(),
        rush_number: 12,
        sorting_status: "IN_CLOUD".to_string(),
        sorting_order: 3,
        sorting_tags: vec!["Follow up".to_string()],
    };
    assert_eq!(
        serde_json::to_value(rushee).unwrap(),
        json!({
            "id": "900000001", "fullName": "Test Rushee", "rushNumber": 12,
            "sortingStatus": "IN_CLOUD", "sortingOrder": 3, "sortingTags": ["Follow up"]
        })
    );
}

#[test]
fn notes_payload_defaults_missing_tags_and_requires_notes() {
    let payload: NotesPayload =
        serde_json::from_value(json!({"sortingNotes": "Observation"})).unwrap();
    assert_eq!(payload.sorting_notes, "Observation");
    assert!(payload.sorting_tags.is_empty());
    assert!(serde_json::from_value::<NotesPayload>(json!({"sortingTags": []})).is_err());
}

#[test]
fn sorting_move_and_reorder_payloads_preserve_order_and_signed_indices() {
    let movement: MoveRusheePayload = serde_json::from_value(json!({
        "fromColumn": "UNSORTED", "toColumn": "IN_CLOUD",
        "movedRusheeId": "900000001", "targetIndex": -1
    }))
    .unwrap();
    assert_eq!(movement.target_index, -1);
    assert_eq!(movement.from_column, "UNSORTED");
    assert_eq!(movement.to_column, "IN_CLOUD");
    assert_eq!(movement.moved_rushee_id, "900000001");
    let reorder: BulkReorderPayload = serde_json::from_value(json!({
        "column": "IN_CLOUD", "orderedRusheeIds": ["2", "1", "2"]
    }))
    .unwrap();
    assert_eq!(reorder.ordered_rushee_ids, ["2", "1", "2"]);
}
