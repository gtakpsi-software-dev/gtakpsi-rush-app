// Wraps a rushee or question channel payload in its client-facing event envelope.
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

// Builds a vote-list event from valid JSON entries in the Redis vote log.
pub(crate) fn vote_update(values: Vec<String>) -> String {
    // Ignore malformed stored votes so one bad entry does not hide the tally.
    let votes: Vec<serde_json::Value> = values
        .into_iter()
        .filter_map(|value| serde_json::from_str(&value).ok())
        .collect();

    serde_json::json!({
        "type": "vote_update",
        "votes": votes
    })
    .to_string()
}
