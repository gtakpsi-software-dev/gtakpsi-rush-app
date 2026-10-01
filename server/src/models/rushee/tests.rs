use super::*;
use serde_json::{json, Value};

fn legacy_rushee() -> Value {
    json!({
        "first_name": "Test", "last_name": "Rushee", "housing": "Campus",
        "phone_number": "(404) 555-0100", "email": "test@example.invalid",
        "gtid": "900000001", "major": "Business", "class": "First Year",
        "pronouns": "they/them", "image_url": "headshot", "exposure": "Event",
        "pis_meeting_id": "meeting", "pis_timeslot": {"$date": {"$numberLong": "0"}},
        "pis_link": "interview", "cloud": "IN_CLOUD", "pis": [],
        "comments": [], "attendance": [], "ratings": [], "access_code": "private-code",
        "flex_window": false,
        "pis_signup": {
            "time": {"$date": {"$numberLong": "0"}}, "rushee_first_name": "Test",
            "rushee_last_name": "Rushee", "rushee_gtid": "900000001",
            "first_brother_first_name": "", "first_brother_last_name": "",
            "second_brother_first_name": "", "second_brother_last_name": "",
            "flex_window": false
        }
    })
}

#[test]
fn legacy_documents_keep_sorting_defaults_and_discard_persisted_interaction_counts() {
    let mut document = legacy_rushee();
    document["interactions_by_night"] =
        json!([{"night_index": 1, "name": "Night 1", "interactions": 99}]);
    let rushee: RusheeModel = serde_json::from_value(document).unwrap();
    assert_eq!(rushee.sorting_status, "UNSORTED");
    assert_eq!(rushee.sorting_order, 0);
    assert!(rushee.sorting_notes.is_empty());
    assert!(rushee.sorting_tags.is_empty());
    assert!(rushee.rush_number.is_none());
    assert!(rushee.assigned_pis_questions.is_none());
    assert!(rushee.interactions_by_night.is_empty());
}

#[test]
fn self_view_serializes_only_the_existing_public_fields() {
    let mut document = legacy_rushee();
    document["sorting_notes"] = json!("Private committee note");
    document["ratings"] = json!([{"name": "Professionalism", "value": 5.0}]);
    let rushee: RusheeModel = serde_json::from_value(document.clone()).unwrap();
    let actual = serde_json::to_value(RusheeSelfView::from(rushee)).unwrap();
    let public_fields = [
        "first_name",
        "last_name",
        "housing",
        "phone_number",
        "email",
        "gtid",
        "major",
        "class",
        "pronouns",
        "image_url",
        "attendance",
        "pis_timeslot",
    ];
    let expected: serde_json::Map<String, Value> = public_fields
        .into_iter()
        .map(|field| (field.to_string(), document[field].clone()))
        .collect();
    assert_eq!(actual, Value::Object(expected));
}

#[test]
fn vote_option_wire_names_remain_case_sensitive() {
    assert_eq!(
        serde_json::to_value(VoteOption::NotVoted).unwrap(),
        json!("NotVoted")
    );
    assert_eq!(
        serde_json::to_value(VoteOption::Abstain).unwrap(),
        json!("Abstain")
    );
    assert!(serde_json::from_value::<VoteOption>(json!("yes")).is_err());
}

#[test]
fn incoming_and_stored_votes_keep_their_wire_fields() {
    let incoming = json!({
        "brother_id": "900000001",
        "first_name": "Ada",
        "last_name": "Example",
        "vote": "Yes"
    });
    let parsed: IncomingRusheeVote = serde_json::from_value(incoming.clone()).unwrap();
    assert_eq!(serde_json::to_value(parsed).unwrap(), incoming);

    let stored = RusheeVote {
        brother_id: "900000001".to_string(),
        first_name: "Ada".to_string(),
        last_name: "Example".to_string(),
        vote: VoteOption::Yes,
    };
    assert_eq!(serde_json::to_value(stored).unwrap(), incoming);
}
