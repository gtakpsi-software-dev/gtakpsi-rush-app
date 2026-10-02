use crate::models::misc::RushNight;
use crate::models::rushee::{RusheeModel, StrippedRushee};
use crate::services::rush_nights::interactions_by_night;

pub(super) fn project_list_rushee(
    record: RusheeModel,
    rush_nights: &[RushNight],
    registration_order: i32,
) -> StrippedRushee {
    let night_interactions =
        interactions_by_night(rush_nights, &record.attendance, &record.comments);

    // INVARIANT: the list projection excludes access codes, comments, and sorting notes.
    StrippedRushee {
        name: format!("{} {}", record.first_name, record.last_name),
        first_name: record.first_name.clone(),
        last_name: record.last_name.clone(),
        class: record.class,
        gtid: record.gtid,
        major: record.major,
        ratings: record.ratings,
        image_url: record.image_url,
        email: record.email,
        pronouns: record.pronouns,
        attendance: record.attendance,
        registration_order,
        pis_timeslot: Some(record.pis_timeslot),
        interactions_by_night: night_interactions,
    }
}

#[cfg(test)]
mod tests;
