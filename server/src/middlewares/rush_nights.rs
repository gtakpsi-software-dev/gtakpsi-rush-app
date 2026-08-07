use bson::DateTime;

use crate::middlewares::timeHelpers::same_day;
use crate::models::misc::RushNight;
use crate::models::Rushee::{Comment, NightInteractionSummary, RusheeModel};

/// Default rush nights for interaction display (merged with Mongo when missing).
/// Times are used for ordering and same-day matching when not overridden by DB.
fn canonical_rush_nights() -> Vec<RushNight> {
    vec![
        RushNight {
            name: "Night 1".to_string(),
            time: DateTime::parse_rfc3339_str("2026-01-28T22:00:00Z").unwrap(),
        },
        RushNight {
            name: "Night 2".to_string(),
            time: DateTime::parse_rfc3339_str("2026-01-29T22:00:00Z").unwrap(),
        },
        RushNight {
            name: "Closed Night".to_string(),
            time: DateTime::parse_rfc3339_str("2026-02-03T22:00:00Z").unwrap(),
        },
        RushNight {
            name: "Dev Night".to_string(),
            time: DateTime::parse_rfc3339_str("2099-12-31T22:00:00Z").unwrap(),
        },
    ]
}

fn names_match(a: &str, b: &str) -> bool {
    a.eq_ignore_ascii_case(b)
}

pub fn night_matches(a: &RushNight, b: &RushNight) -> bool {
    names_match(&a.name, &b.name) || same_day(&a.time, &b.time)
}

fn is_dev_night(name: &str) -> bool {
    name.to_lowercase().contains("dev")
}

pub fn merge_rush_nights(db_nights: &[RushNight], comments: &[Comment]) -> Vec<RushNight> {
    let mut merged: Vec<RushNight> = db_nights.to_vec();

    for canon in canonical_rush_nights() {
        if !merged.iter().any(|n| names_match(&n.name, &canon.name)) {
            merged.push(canon);
        }
    }

    for comment in comments {
        let comment_night = &comment.night;
        if !merged.iter().any(|n| night_matches(n, comment_night)) {
            merged.push(comment_night.clone());
        }
    }

    merged.sort_by_key(|n| n.time.timestamp_millis());
    merged
}

fn rushee_attended_night(attendance: &[RushNight], night: &RushNight) -> bool {
    attendance
        .iter()
        .any(|a| night_matches(a, night))
}

fn unique_brothers_for_night(comments: &[Comment], night: &RushNight) -> i32 {
    use std::collections::HashSet;
    let mut names = HashSet::new();
    for comment in comments {
        if night_matches(&comment.night, night) {
            names.insert(comment.brother_name.as_str());
        }
    }
    names.len() as i32
}

pub fn interactions_by_night(
    db_rush_nights: &[RushNight],
    attendance: &[RushNight],
    comments: &[Comment],
) -> Vec<NightInteractionSummary> {
    let nights = merge_rush_nights(db_rush_nights, comments);

    nights
        .iter()
        .enumerate()
        .map(|(i, night)| {
            let count = unique_brothers_for_night(comments, night);
            let attended = rushee_attended_night(attendance, night);

            let interactions = if is_dev_night(&night.name) {
                Some(count)
            } else if !attended {
                None
            } else {
                Some(count)
            };

            NightInteractionSummary {
                night_index: (i + 1) as i32,
                name: night.name.clone(),
                interactions,
            }
        })
        .collect()
}

pub fn enrich_interactions_by_night(rushee: &mut RusheeModel, db_rush_nights: &[RushNight]) {
    rushee.interactions_by_night =
        interactions_by_night(db_rush_nights, &rushee.attendance, &rushee.comments);
}
