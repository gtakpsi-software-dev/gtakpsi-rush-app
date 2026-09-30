use super::*;
use serde_json::json;

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
        fullName: "Test Rushee".to_string(),
        rushNumber: 12,
        sortingStatus: "IN_CLOUD".to_string(),
        sortingOrder: 3,
        sortingTags: vec!["Follow up".to_string()],
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
    assert_eq!(payload.sortingNotes, "Observation");
    assert!(payload.sortingTags.is_empty());
    assert!(serde_json::from_value::<NotesPayload>(json!({"sortingTags": []})).is_err());
}

#[test]
fn sorting_move_and_reorder_payloads_preserve_order_and_signed_indices() {
    let movement: MoveRusheePayload = serde_json::from_value(json!({
        "fromColumn": "UNSORTED", "toColumn": "IN_CLOUD",
        "movedRusheeId": "900000001", "targetIndex": -1
    }))
    .unwrap();
    assert_eq!(movement.targetIndex, -1);
    assert_eq!(movement.fromColumn, "UNSORTED");
    assert_eq!(movement.toColumn, "IN_CLOUD");
    assert_eq!(movement.movedRusheeId, "900000001");
    let reorder: BulkReorderPayload = serde_json::from_value(json!({
        "column": "IN_CLOUD", "orderedRusheeIds": ["2", "1", "2"]
    }))
    .unwrap();
    assert_eq!(reorder.orderedRusheeIds, ["2", "1", "2"]);
}
