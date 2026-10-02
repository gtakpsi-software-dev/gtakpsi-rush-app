use super::autosave::{stored_brother_name, PISAutosavePayload};
use serde_json::json;

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
fn brother_names_keep_trimmed_values_and_the_empty_none_marker() {
    assert_eq!(stored_brother_name(" Alex "), "Alex");
    assert_eq!(stored_brother_name("  \t\n  "), "none");
    assert_eq!(stored_brother_name(""), "none");
    assert_eq!(stored_brother_name("Mary Jane"), "Mary Jane");
}
