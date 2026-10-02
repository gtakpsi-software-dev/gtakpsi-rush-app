mod execution;
mod loading;
mod persistence;

pub(crate) use execution::assign_rushees;
pub(crate) use loading::{load_brother_availabilities, load_rushees};

use crate::models::pis::{BrotherPISAvailability, PISSignup};
use std::collections::{HashMap, HashSet};

type BrotherName = (String, String);
pub(crate) type AvailabilityByTimeslot = HashMap<i64, Vec<BrotherName>>;

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

#[derive(Default)]
pub(crate) struct AssignmentPlanner {
    total_assignments: HashMap<String, i32>,
    assigned_by_timeslot: HashMap<i64, HashSet<String>>,
}

pub(crate) struct AssignmentPlan {
    pub first: Option<BrotherName>,
    pub second: Option<BrotherName>,
    pub still_missing_first: bool,
    pub still_missing_second: bool,
}

impl AssignmentPlanner {
    pub fn register_existing(&mut self, timeslot: i64, signup: &PISSignup) {
        let assigned = self.assigned_by_timeslot.entry(timeslot).or_default();

        for (first, last) in [
            (
                &signup.first_brother_first_name,
                &signup.first_brother_last_name,
            ),
            (
                &signup.second_brother_first_name,
                &signup.second_brother_last_name,
            ),
        ] {
            if first != "none" {
                let key = format!("{} {}", first.trim(), last.trim());
                assigned.insert(key.clone());
                *self.total_assignments.entry(key).or_default() += 1;
            }
        }
    }

    pub fn plan(
        &mut self,
        timeslot: i64,
        signup: &PISSignup,
        available: &[BrotherName],
    ) -> AssignmentPlan {
        let assigned = self.assigned_by_timeslot.entry(timeslot).or_default();
        let needs_first = signup.first_brother_first_name == "none";
        let needs_second = signup.second_brother_first_name == "none";
        let first = if needs_first {
            reserve_available(available, assigned, &mut self.total_assignments, None)
        } else {
            None
        };

        let second = if needs_second {
            let first_name = first.as_ref().map_or_else(
                || {
                    format!(
                        "{} {}",
                        signup.first_brother_first_name.trim(),
                        signup.first_brother_last_name.trim()
                    )
                },
                |chosen| format!("{} {}", chosen.0.trim(), chosen.1.trim()),
            );
            reserve_available(
                available,
                assigned,
                &mut self.total_assignments,
                Some(&first_name),
            )
        } else {
            None
        };

        AssignmentPlan {
            still_missing_first: needs_first && first.is_none(),
            still_missing_second: needs_second && second.is_none(),
            first,
            second,
        }
    }
}

fn reserve_available(
    available: &[BrotherName],
    assigned: &mut HashSet<String>,
    total_assignments: &mut HashMap<String, i32>,
    exclude: Option<&str>,
) -> Option<BrotherName> {
    let chosen = least_assigned_available(available, assigned, total_assignments, exclude)?;
    let key = format!("{} {}", chosen.0, chosen.1);

    // INVARIANT: reserve before persistence. A later write failure must not let
    // this planning run reuse the brother at the same timeslot.
    *total_assignments.entry(key.clone()).or_default() += 1;
    assigned.insert(key);
    Some(chosen)
}

fn least_assigned_available(
    available: &[BrotherName],
    assigned: &HashSet<String>,
    total_assignments: &HashMap<String, i32>,
    exclude: Option<&str>,
) -> Option<BrotherName> {
    // Choose one minimum directly instead of sorting every candidate. Ties
    // retain submission order; callers do not need the remaining ranked list.
    available
        .iter()
        .filter(|(first, last)| {
            let key = format!("{} {}", first.trim(), last.trim());
            !assigned.contains(&key) && exclude != Some(key.as_str())
        })
        .min_by_key(|(first, last)| {
            total_assignments
                .get(&format!("{first} {last}"))
                .copied()
                .unwrap_or_default()
        })
        .cloned()
}

#[cfg(test)]
mod tests;
