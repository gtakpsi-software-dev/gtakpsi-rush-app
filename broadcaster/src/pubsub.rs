pub(crate) fn shared_update(channel: &str, payload: &str) -> Option<String> {
    let message = match channel {
        "rushee" => serde_json::json!({
            "type": "rushee_update",
            "rushee": payload
        }),
        "question" => serde_json::json!({
            "type": "question_update",
            "question": payload
        }),
        _ => return None,
    };

    Some(message.to_string())
}
