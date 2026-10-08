use super::*;
use crate::models::{
    rush_nights::RushNight,
    rushee::{Comment, Rating},
};
use bson::{doc, DateTime};
use std::collections::HashMap;

// Build a comment fixture containing the supplied category ratings.
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

// Verify that only finite ratings from one through five contribute to averages.
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

// Verify first-match category selection and inclusion of a new rating.
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

// Verify invalid-rating filtering and the absence of an average without valid values.
#[test]
fn rating_average_excludes_legacy_and_invalid_values_and_preserves_empty_result() {
    let comments = [comment(&[("fit", 0.0)]), comment(&[("fit", f32::NAN)])];

    assert_eq!(average_rating_value(&comments, "fit", None), None);
    assert_eq!(average_rating_value(&comments, "fit", Some(6.0)), None);
    assert_eq!(average_rating_value(&comments, "fit", Some(2.5)), Some(2.5));
}

// Verify MongoDB filters and updates for existing and new rating categories.
#[test]
fn rating_updates_keep_existing_and_new_category_filters_and_operators() {
    let rating = Rating {
        name: "Professionalism".into(),
        value: 4.0,
    };

    assert_eq!(
        rating_updates::build_rating_update("123", &rating, 3.0, true),
        (
            doc! { "gtid": "123", "ratings.name": "Professionalism" },
            doc! { "$set": { "ratings.$.value": 3.0 } },
        )
    );
    assert_eq!(
        rating_updates::build_rating_update("123", &rating, 3.0, false),
        (
            doc! { "gtid": "123" },
            doc! { "$push": { "ratings": { "name": "Professionalism", "value": 3.0 } } },
        )
    );
}

// Verify that deletion recalculates only affected categories from surviving comments.
#[test]
fn deletion_recalculates_only_deleted_categories_after_same_day_filtering() {
    let mut earlier = comment(&[("fit", 1.0), ("other", 3.0)]);
    earlier.brother_name = "Other".into();
    let mut same_day = comment(&[("fit", 5.0)]);
    same_day.brother_name = "Alex".into();
    same_day.night.time = DateTime::from_millis(1);
    let mut next_day = comment(&[("fit", 4.0), ("new", 5.0)]);
    next_day.brother_name = "Alex".into();
    next_day.night.time = DateTime::from_millis(86_400_000);
    let mut deleted = comment(&[("fit", 2.0), ("new", 1.0), ("new", 4.0)]);
    deleted.brother_name = "Alex".into();

    let values: HashMap<_, _> = deletion_plan::rating_recalculations_after_deletion(
        vec![earlier, same_day, next_day],
        &deleted,
    )
    .into_iter()
    .collect();
    assert_eq!(values.len(), 2);
    assert_eq!(values["fit"], Some(2.5));
    assert_eq!(values["new"], Some(5.0));
}

// Verify that a category without valid surviving ratings is marked for removal.
#[test]
fn deletion_removes_a_category_when_no_valid_rating_remains() {
    let mut deleted = comment(&[("fit", 3.0), ("fit", 5.0)]);
    deleted.brother_name = "Alex".into();
    let mut legacy = comment(&[("fit", 0.0)]);
    legacy.brother_name = "Other".into();

    let values = deletion_plan::rating_recalculations_after_deletion(vec![legacy], &deleted);
    assert_eq!(values, vec![("fit".to_string(), None)]);
}

// Verify the positional update and error message for a recalculated average.
#[test]
fn deletion_updates_existing_rating_with_the_original_positional_filter() {
    let (filter, update, error) =
        deletion_plan::rating_update_for_deletion("123", "fit", Some(3.5));

    assert_eq!(filter, doc! { "gtid": "123", "ratings.name": "fit" });
    assert_eq!(update, doc! { "$set": { "ratings.$.value": 3.5 } });
    assert_eq!(error, "error updating ratings after comment deletion");
}

// Verify the removal update and error message for an empty rating category.
#[test]
fn deletion_removes_empty_rating_category_with_the_original_pull() {
    let (filter, update, error) = deletion_plan::rating_update_for_deletion("123", "fit", None);

    assert_eq!(filter, doc! { "gtid": "123" });
    assert_eq!(update, doc! { "$pull": { "ratings": { "name": "fit" } } });
    assert_eq!(
        error,
        "error removing rating category after comment deletion"
    );
}
