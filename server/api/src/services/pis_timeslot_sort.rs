use serde_json::Value;

// Sort timeslots by their extended JSON timestamp, retaining order for equal times.
pub(crate) fn sort_available_timeslots(timeslots: &mut [Value]) {
    timeslots.sort_by(|left, right| {
        let left_time = sort_time(left);
        let right_time = sort_time(right);
        left_time.cmp(&right_time)
    });
}

// Read a string epoch timestamp from extended JSON, falling back to zero.
fn sort_time(timeslot: &Value) -> i64 {
    // Missing or malformed extended-JSON dates retain the existing zero fallback.
    timeslot["time"]["$date"]["$numberLong"]
        .as_str()
        .unwrap_or("0")
        .parse::<i64>()
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // Verify timestamp ordering, zero fallbacks, and stable ties.
    #[test]
    fn available_timeslots_keep_zero_fallback_and_stable_equal_time_order() {
        let mut timeslots = vec![
            json!({"id": "late-a", "time": {"$date": {"$numberLong": "100"}}}),
            json!({"id": "malformed", "time": {"$date": {"$numberLong": "bad"}}}),
            json!({"id": "early", "time": {"$date": {"$numberLong": "-5"}}}),
            json!({"id": "missing"}),
            json!({"id": "late-b", "time": {"$date": {"$numberLong": "100"}}}),
        ];

        sort_available_timeslots(&mut timeslots);

        let ids: Vec<_> = timeslots
            .iter()
            .map(|timeslot| timeslot["id"].as_str().unwrap())
            .collect();
        assert_eq!(ids, ["early", "malformed", "missing", "late-a", "late-b"]);
    }

    // Verify that non-string epoch values receive the zero sort key.
    #[test]
    fn non_string_epoch_values_sort_with_the_zero_fallback() {
        let mut timeslots = vec![
            json!({"id": "positive", "time": {"$date": {"$numberLong": "1"}}}),
            json!({"id": "number", "time": {"$date": {"$numberLong": 10}}}),
        ];

        sort_available_timeslots(&mut timeslots);
        assert_eq!(timeslots[0]["id"], "number");
        assert_eq!(timeslots[1]["id"], "positive");
    }
}
