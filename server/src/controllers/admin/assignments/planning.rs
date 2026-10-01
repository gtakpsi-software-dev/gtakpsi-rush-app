use crate::models::pis::{BrotherPISAvailability, PISSignup};
use std::collections::{HashMap, HashSet};

type BrotherName = (String, String);

pub(super) fn index_availability(
    availabilities: &[BrotherPISAvailability],
) -> HashMap<i64, Vec<BrotherName>> {
    let mut by_timeslot: HashMap<i64, Vec<BrotherName>> = HashMap::new();

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
pub(super) struct AssignmentPlanner {
    total_assignments: HashMap<String, i32>,
    assigned_by_timeslot: HashMap<i64, HashSet<String>>,
}

pub(super) struct AssignmentPlan {
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
        let mut first = None;
        let mut second = None;

        if needs_first {
            let eligible = ranked_available(available, assigned, &self.total_assignments, None);
            if let Some(chosen) = eligible.first() {
                let key = format!("{} {}", chosen.0, chosen.1);
                *self.total_assignments.entry(key.clone()).or_default() += 1;
                assigned.insert(key);
                first = Some(chosen.clone());
            }
        }

        if needs_second {
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
            let eligible = ranked_available(
                available,
                assigned,
                &self.total_assignments,
                Some(&first_name),
            );
            if let Some(chosen) = eligible.first() {
                let key = format!("{} {}", chosen.0, chosen.1);
                *self.total_assignments.entry(key.clone()).or_default() += 1;
                assigned.insert(key);
                second = Some(chosen.clone());
            }
        }

        // INVARIANT: keep these reservations even if a later database write fails.
        // The next rushee must not receive the same brother at this timeslot in this run.
        AssignmentPlan {
            still_missing_first: needs_first && first.is_none(),
            still_missing_second: needs_second && second.is_none(),
            first,
            second,
        }
    }
}

fn ranked_available(
    available: &[BrotherName],
    assigned: &HashSet<String>,
    total_assignments: &HashMap<String, i32>,
    exclude: Option<&str>,
) -> Vec<BrotherName> {
    let mut eligible: Vec<_> = available
        .iter()
        .filter(|(first, last)| {
            let key = format!("{} {}", first.trim(), last.trim());
            !assigned.contains(&key) && exclude != Some(key.as_str())
        })
        .cloned()
        .collect();

    // Stable ordering preserves availability submission order when assignment counts tie.
    eligible.sort_by(|a, b| {
        let a_count = total_assignments
            .get(&format!("{} {}", a.0, a.1))
            .unwrap_or(&0);
        let b_count = total_assignments
            .get(&format!("{} {}", b.0, b.1))
            .unwrap_or(&0);
        a_count.cmp(b_count)
    });
    eligible
}

#[cfg(test)]
mod tests;
