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
mod tests {
    use super::*;
    use bson::DateTime;

    fn signup(first: (&str, &str), second: (&str, &str)) -> PISSignup {
        PISSignup {
            time: DateTime::from_millis(0),
            rushee_first_name: String::new(),
            rushee_last_name: String::new(),
            rushee_gtid: String::new(),
            first_brother_first_name: first.0.into(),
            first_brother_last_name: first.1.into(),
            second_brother_first_name: second.0.into(),
            second_brother_last_name: second.1.into(),
            flex_window: false,
        }
    }

    fn brothers() -> Vec<BrotherName> {
        vec![
            ("Ada".into(), "Lovelace".into()),
            ("Grace".into(), "Hopper".into()),
        ]
    }

    #[test]
    fn availability_preserves_submission_order_and_skips_blank_names() {
        let make = |first: &str, last: &str, slots: Vec<i64>| BrotherPISAvailability {
            brother_uid: String::new(),
            brother_email: String::new(),
            brother_first_name: first.into(),
            brother_last_name: last.into(),
            available_timeslots: slots.into_iter().map(DateTime::from_millis).collect(),
            submitted_at: DateTime::from_millis(0),
        };
        let indexed = index_availability(&[
            make(" Ada ", " Lovelace ", vec![1, 2]),
            make(" ", "Ignored", vec![1]),
            make("Grace", "Hopper", vec![1]),
            make(" Ada ", " Lovelace ", vec![1]),
        ]);

        assert_eq!(
            indexed.get(&1).unwrap(),
            &vec![
                brothers()[0].clone(),
                brothers()[1].clone(),
                brothers()[0].clone()
            ]
        );
        assert_eq!(indexed.get(&2).unwrap(), &vec![brothers()[0].clone()]);
    }

    #[test]
    fn planning_balances_load_and_reserves_brothers_per_timeslot() {
        let mut planner = AssignmentPlanner::default();
        planner.register_existing(1, &signup(("Ada", "Lovelace"), ("none", "none")));

        let first = planner.plan(2, &signup(("none", "none"), ("none", "none")), &brothers());
        assert_eq!(first.first, Some(("Grace".into(), "Hopper".into())));
        assert_eq!(first.second, Some(("Ada".into(), "Lovelace".into())));
        assert!(!first.still_missing_first && !first.still_missing_second);

        let next = planner.plan(2, &signup(("none", "none"), ("none", "none")), &brothers());
        assert!(next.first.is_none() && next.second.is_none());
        assert!(next.still_missing_first && next.still_missing_second);
    }

    #[test]
    fn existing_assignments_block_conflicts_and_keep_partial_failure() {
        let mut planner = AssignmentPlanner::default();
        planner.register_existing(1, &signup((" Ada ", " Lovelace "), ("none", "none")));
        let plan = planner.plan(1, &signup(("none", "none"), ("none", "none")), &brothers());

        assert_eq!(plan.first, Some(("Grace".into(), "Hopper".into())));
        assert_eq!(plan.second, None);
        assert!(!plan.still_missing_first && plan.still_missing_second);
    }

    #[test]
    fn second_only_assignment_excludes_existing_first_and_uses_tie_order() {
        let mut planner = AssignmentPlanner::default();
        let available = vec![
            ("Ada".into(), "Lovelace".into()),
            ("Grace".into(), "Hopper".into()),
            ("Katherine".into(), "Johnson".into()),
        ];
        let plan = planner.plan(
            1,
            &signup((" Ada ", " Lovelace "), ("none", "none")),
            &available,
        );

        assert_eq!(plan.first, None);
        assert_eq!(plan.second, Some(("Grace".into(), "Hopper".into())));
        assert!(!plan.still_missing_first && !plan.still_missing_second);
    }
}
