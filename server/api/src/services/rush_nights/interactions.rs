use std::collections::HashSet;

use crate::models::rush_nights::RushNight;
use crate::models::rushee::{Comment, NightInteractionSummary, RusheeModel};

use super::{merge_rush_nights, night_matches};

fn is_dev_night(name: &str) -> bool {
    name.to_lowercase().contains("dev")
}

fn rushee_attended_night(attendance: &[RushNight], night: &RushNight) -> bool {
    attendance
        .iter()
        .any(|attended| night_matches(attended, night))
}

fn unique_brothers_for_night(comments: &[Comment], night: &RushNight) -> i32 {
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

            // Development nights expose counts without the attendance gate.
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
