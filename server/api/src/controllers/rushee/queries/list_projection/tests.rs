use serde_json::json;

use super::project_list_rushee;
use crate::models::rushee::RusheeModel;

// Verify list-view fields and exclusion of private record details.
#[test]
fn list_projection_preserves_public_fields_and_excludes_private_details() {
    let record: RusheeModel = serde_json::from_value(json!({
        "first_name": "Ada", "last_name": "Example", "housing": "Campus",
        "phone_number": "(404) 555-0100", "email": "ada@example.invalid",
        "gtid": "900000001", "major": "Business", "class": "Third Year",
        "pronouns": "she/her", "image_url": "headshot", "exposure": "Event",
        "pis_meeting_id": "meeting", "pis_timeslot": {"$date": {"$numberLong": "0"}},
        "pis_link": "interview", "cloud": "private-cloud", "pis": [],
        "comments": [], "attendance": [],
        "ratings": [{"name": "Leadership", "value": 4.5}],
        "access_code": "private-code", "flex_window": false,
        "sorting_notes": "private committee note",
        "pis_signup": {
            "time": {"$date": {"$numberLong": "0"}},
            "rushee_first_name": "Ada", "rushee_last_name": "Example",
            "rushee_gtid": "900000001", "first_brother_first_name": "none",
            "first_brother_last_name": "none", "second_brother_first_name": "none",
            "second_brother_last_name": "none", "flex_window": false
        }
    }))
    .unwrap();

    let actual = serde_json::to_value(project_list_rushee(record, &[], 7)).unwrap();
    assert_eq!(actual.as_object().unwrap().len(), 14);
    assert_eq!(actual["name"], "Ada Example");
    assert_eq!(actual["first_name"], "Ada");
    assert_eq!(actual["last_name"], "Example");
    assert_eq!(actual["gtid"], "900000001");
    assert_eq!(
        actual["ratings"],
        json!([{"name": "Leadership", "value": 4.5}])
    );
    assert_eq!(actual["registration_order"], 7);
    assert_eq!(
        actual["pis_timeslot"],
        json!({"$date": {"$numberLong": "0"}})
    );
    assert_eq!(
        actual["interactions_by_night"],
        json!([
            {"night_index": 1, "name": "Night 1", "interactions": null},
            {"night_index": 2, "name": "Night 2", "interactions": null},
            {"night_index": 3, "name": "Closed Night", "interactions": null}
        ])
    );
    for private_field in [
        "access_code",
        "comments",
        "sorting_notes",
        "cloud",
        "pis",
        "pis_signup",
        "housing",
        "phone_number",
        "exposure",
        "pis_link",
    ] {
        assert_eq!(actual.get(private_field), None, "{private_field} leaked");
    }
    assert!(actual.get("email").is_some());
    assert!(actual.get("major").is_some());
    assert!(actual.get("class").is_some());
    assert!(actual.get("pronouns").is_some());
    assert!(actual.get("attendance").is_some());
    assert!(actual.get("image_url").is_some());
}
