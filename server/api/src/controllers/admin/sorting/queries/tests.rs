use super::*;
use crate::models::rushee::RusheeModel;
use serde_json::json;

// Build a legacy rushee fixture for sorting projections.
fn rushee() -> RusheeModel {
    serde_json::from_value(json!({
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
    }))
    .unwrap()
}

// Verify that only administrator board cards reveal rush numbers.
#[test]
fn sorting_projection_preserves_admin_number_and_redacts_public_number() {
    let mut document = rushee();
    document.sorting_status = "IN_CLOUD".to_string();
    document.sorting_order = 4;
    document.rush_number = Some(37);
    document.sorting_tags = vec!["pis".to_string()];

    let admin =
        serde_json::to_value(project_sorting_rushee(&document, 2, SortingAudience::Admin)).unwrap();
    let public = serde_json::to_value(project_sorting_rushee(
        &document,
        2,
        SortingAudience::Public,
    ))
    .unwrap();
    assert_eq!(
        admin,
        json!({
            "id": "900000001", "fullName": "Test Rushee", "rushNumber": 37,
            "sortingStatus": "IN_CLOUD", "sortingOrder": 4, "sortingTags": ["pis"]
        })
    );
    assert_eq!(public["rushNumber"], 0);
    assert_eq!(
        public.as_object().unwrap().len(),
        admin.as_object().unwrap().len()
    );
    for (key, value) in admin.as_object().unwrap() {
        if key != "rushNumber" {
            assert_eq!(&public[key], value);
        }
    }
}

// Verify fallback values and deterministic board ordering.
#[test]
fn sorting_projection_keeps_legacy_fallbacks_and_ordering() {
    let mut document = rushee();
    document.sorting_status = "unknown".to_string();
    document.sorting_order = 0;
    let fallback =
        serde_json::to_value(project_sorting_rushee(&document, 3, SortingAudience::Admin)).unwrap();
    assert_eq!(fallback["sortingStatus"], "UNSORTED");
    assert_eq!(fallback["sortingOrder"], 3);
    assert_eq!(fallback["rushNumber"], 3);

    let mut list = vec![
        SortingRushee {
            id: "b".into(),
            full_name: "B".into(),
            rush_number: 0,
            sorting_status: "IN_CLOUD".into(),
            sorting_order: 2,
            sorting_tags: vec![],
        },
        SortingRushee {
            id: "z".into(),
            full_name: "Z".into(),
            rush_number: 0,
            sorting_status: "UNSORTED".into(),
            sorting_order: 1,
            sorting_tags: vec![],
        },
        SortingRushee {
            id: "a".into(),
            full_name: "A".into(),
            rush_number: 0,
            sorting_status: "IN_CLOUD".into(),
            sorting_order: 2,
            sorting_tags: vec![],
        },
    ];
    sort_sorting_rushees(&mut list);
    let ids: Vec<&str> = list.iter().map(|rushee| rushee.id.as_str()).collect();
    assert_eq!(ids, ["z", "a", "b"]);
}
