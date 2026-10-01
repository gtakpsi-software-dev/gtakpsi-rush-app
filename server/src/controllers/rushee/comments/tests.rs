use super::*;
use crate::models::{
    misc::RushNight,
    rushee::{Comment, Rating},
};
use bson::DateTime;

fn comment(ratings: &[(&str, f32)]) -> Comment {
    Comment {
        brother_id: String::new(),
        brother_name: String::new(),
        comment: String::new(),
        ratings: ratings
            .iter()
            .map(|(name, value)| Rating {
                name: (*name).into(),
                value: *value,
            })
            .collect(),
        night: RushNight {
            name: "Night 1".into(),
            time: DateTime::from_millis(0),
        },
    }
}

#[test]
fn averaging_accepts_the_closed_one_to_five_range_including_fractional_values() {
    for value in [1.0, 1.5, 3.0, 5.0] {
        assert!(is_modern_rating_value(value));
    }
    for value in [
        -1.0,
        0.0,
        0.99,
        5.01,
        f32::NAN,
        f32::INFINITY,
        f32::NEG_INFINITY,
    ] {
        assert!(!is_modern_rating_value(value));
    }
}

#[test]
fn rating_average_uses_first_matching_rating_per_comment_and_appends_new_value_last() {
    let comments = [
        comment(&[("fit", 1.0), ("fit", 5.0)]),
        comment(&[("fit", 0.0)]),
        comment(&[("other", 4.0), ("fit", 3.0)]),
    ];

    assert_eq!(average_rating_value(&comments, "fit", None), Some(2.0));
    assert_eq!(average_rating_value(&comments, "fit", Some(5.0)), Some(3.0));
    assert_eq!(average_rating_value(&comments, "other", None), Some(4.0));
}

#[test]
fn rating_average_excludes_legacy_and_invalid_values_and_preserves_empty_result() {
    let comments = [comment(&[("fit", 0.0)]), comment(&[("fit", f32::NAN)])];

    assert_eq!(average_rating_value(&comments, "fit", None), None);
    assert_eq!(average_rating_value(&comments, "fit", Some(6.0)), None);
    assert_eq!(average_rating_value(&comments, "fit", Some(2.5)), Some(2.5));
}
