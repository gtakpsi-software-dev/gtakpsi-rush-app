use super::*;

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
