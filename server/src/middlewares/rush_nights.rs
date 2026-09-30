use bson::DateTime;

use crate::middlewares::timeHelpers::same_day;
use crate::models::misc::RushNight;
use crate::models::Rushee::{Comment, NightInteractionSummary, RusheeModel};

/// Default rush nights for interaction display (merged with Mongo when missing).
/// Times are used for ordering and same-day matching when not overridden by DB.
fn canonical_rush_nights() -> Vec<RushNight> {
    // Fall 2026 rush nights. Times are 7:00 PM ET (23:00 UTC during EDT).
    vec![
        RushNight {
            name: "Night 1".to_string(),
            time: DateTime::parse_rfc3339_str("2026-09-09T23:00:00Z").unwrap(),
        },
        RushNight {
            name: "Night 2".to_string(),
            time: DateTime::parse_rfc3339_str("2026-09-10T23:00:00Z").unwrap(),
        },
        RushNight {
            name: "Closed Night".to_string(),
            time: DateTime::parse_rfc3339_str("2026-09-15T23:00:00Z").unwrap(),
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

/// The rush night that a comment or check-in happening at `now` should be
/// attributed to: the latest night whose start time has passed, allowing a
/// 1-hour lead-in so activity that trickles in shortly before the event still
/// counts. Falls back to the earliest night if none have started yet.
///
/// This replaces plain same-day matching so that, e.g., comments posted after
/// midnight but before the next event still land on the previous night.
pub fn current_rush_night(nights: &[RushNight], now: DateTime) -> Option<RushNight> {
    if nights.is_empty() {
        return None;
    }

    let mut sorted: Vec<&RushNight> = nights.iter().collect();
    sorted.sort_by_key(|n| n.time.timestamp_millis());

    const LEAD_IN_MS: i64 = 60 * 60 * 1000; // 1 hour before start still counts
    let now_ms = now.timestamp_millis();

    let chosen = sorted
        .iter()
        .rev()
        .find(|n| now_ms >= n.time.timestamp_millis() - LEAD_IN_MS)
        .copied()
        .unwrap_or(sorted[0]);

    Some(chosen.clone())
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

#[cfg(test)]
mod tests;
