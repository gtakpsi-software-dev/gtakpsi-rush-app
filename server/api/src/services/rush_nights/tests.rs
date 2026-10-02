use super::*;

fn night(name: &str, time: &str) -> RushNight {
    RushNight {
        name: name.to_string(),
        time: DateTime::parse_rfc3339_str(time).unwrap(),
    }
}

fn comment(name: &str, night: &RushNight) -> Comment {
    Comment {
        brother_id: name.to_string(),
        brother_name: name.to_string(),
        comment: "Observation".to_string(),
        ratings: vec![],
        night: night.clone(),
    }
}

#[test]
fn empty_schedule_has_no_current_night() {
    assert!(current_rush_night(&[], DateTime::from_millis(0)).is_none());
}

#[test]
fn current_night_uses_lead_in_boundary_and_keeps_previous_night_after_midnight() {
    let first = night("Night 1", "2026-09-09T23:00:00Z");
    let second = night("Night 2", "2026-09-10T23:00:00Z");
    let nights = [second, first];
    for (now, expected) in [
        ("2026-09-01T00:00:00Z", "Night 1"),
        ("2026-09-10T05:00:00Z", "Night 1"),
        ("2026-09-10T21:59:59.999Z", "Night 1"),
        ("2026-09-10T22:00:00Z", "Night 2"),
        ("2026-09-20T00:00:00Z", "Night 2"),
    ] {
        let chosen = current_rush_night(&nights, DateTime::parse_rfc3339_str(now).unwrap());
        assert_eq!(chosen.unwrap().name, expected);
    }
    assert_eq!(nights[0].name, "Night 2");
}

#[test]
fn names_match_without_trimming_and_dates_use_the_rush_timezone() {
    let first = night("Night 1", "2026-09-09T23:00:00Z");
    assert!(night_matches(
        &first,
        &night("NIGHT 1", "2026-09-11T23:00:00Z")
    ));
    assert!(!night_matches(
        &first,
        &night(" Night 1 ", "2026-09-11T23:00:00Z")
    ));
    assert!(night_matches(
        &first,
        &night("Other", "2026-09-10T01:00:00Z")
    ));
    assert!(!night_matches(
        &first,
        &night("Other", "2026-09-10T05:00:00Z")
    ));
}

#[test]
fn merging_keeps_database_dates_and_adds_missing_canonical_and_comment_nights() {
    let first = night("Night 1", "2026-09-08T23:00:00Z");
    let extra = night("Extra", "2026-09-20T23:00:00Z");
    let nights = merge_rush_nights(&[first.clone()], &[comment("A", &extra)]);
    assert_eq!(
        nights
            .iter()
            .map(|night| night.name.as_str())
            .collect::<Vec<_>>(),
        vec!["Night 1", "Night 2", "Closed Night", "Extra"]
    );
    assert_eq!(nights[0].time, first.time);
}

#[test]
fn interactions_deduplicate_names_and_require_attendance_except_for_development_nights() {
    let first = night("Night 1", "2026-09-09T23:00:00Z");
    let dev = night("Dev Night", "2026-09-01T23:00:00Z");
    let comments = [
        comment("A", &first),
        comment("A", &first),
        comment("B", &first),
        comment("A", &dev),
    ];
    let result = interactions_by_night(&[dev], &[first.clone()], &comments);
    assert_eq!(
        result
            .iter()
            .map(|night| night.interactions)
            .collect::<Vec<_>>(),
        vec![Some(1), Some(2), None, None]
    );
    assert_eq!(
        result
            .iter()
            .map(|night| night.night_index)
            .collect::<Vec<_>>(),
        vec![1, 2, 3, 4]
    );
    let absent = interactions_by_night(&[], &[], &comments);
    assert_eq!(absent[1].interactions, None);
    let zero = interactions_by_night(&[], &[first], &[]);
    assert_eq!(zero[0].interactions, Some(0));
}
