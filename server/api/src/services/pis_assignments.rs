mod execution;
mod loading;
mod persistence;
mod planning;

pub(crate) use execution::assign_rushees;
pub(crate) use loading::{load_brother_availabilities, load_rushees};

use crate::models::pis::BrotherPISAvailability;
use planning::{AssignmentPlan, AssignmentPlanner, BrotherName};
use std::collections::HashMap;

pub(crate) type AvailabilityByTimeslot = HashMap<i64, Vec<BrotherName>>;

// Index interviewer names by timeslot, trimming names and skipping blank entries.
pub(crate) fn index_availability(
    availabilities: &[BrotherPISAvailability],
) -> AvailabilityByTimeslot {
    let mut by_timeslot = AvailabilityByTimeslot::new();

    for availability in availabilities {
        let first = availability.brother_first_name.trim().to_string();
        let last = availability.brother_last_name.trim().to_string();
        if first.is_empty() || last.is_empty() {
            continue;
        }

        for timeslot in &availability.available_timeslots {
            by_timeslot
                .entry(timeslot.timestamp_millis())
                .or_default()
                .push((first.clone(), last.clone()));
        }
    }

    by_timeslot
}

#[cfg(test)]
mod tests;
