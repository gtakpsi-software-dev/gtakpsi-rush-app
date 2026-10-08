use mongodb::Collection;

use super::persistence::persist_assignment;
use super::{AssignmentPlanner, AvailabilityByTimeslot};
use crate::models::rushee::RusheeModel;

pub(crate) struct AssignmentCounts {
    pub assignments_made: i32,
    pub assignment_failures: i32,
}

// Plan and persist missing interviewers, counting successful writes and unfilled signups.
pub(crate) async fn assign_rushees(
    collection: &Collection<RusheeModel>,
    rushees: &[RusheeModel],
    timeslot_to_brothers: &AvailabilityByTimeslot,
) -> AssignmentCounts {
    let mut planner = AssignmentPlanner::default();

    // Register every existing assignment before choosing new ones so later
    // rushees cannot reserve an occupied brother at the same timeslot.
    for rushee in rushees {
        planner.register_existing(rushee.pis_timeslot.timestamp_millis(), &rushee.pis_signup);
    }

    let mut assignments_made = 0;
    let mut assignment_failures = 0;

    for rushee in rushees {
        let ts_millis = rushee.pis_timeslot.timestamp_millis();

        if rushee.pis_signup.first_brother_first_name != "none"
            && rushee.pis_signup.second_brother_first_name != "none"
        {
            continue;
        }

        let available_brothers = match timeslot_to_brothers.get(&ts_millis) {
            Some(bros) => bros,
            None => {
                assignment_failures += 1;
                continue;
            }
        };

        if available_brothers.is_empty() {
            assignment_failures += 1;
            continue;
        }

        let plan = planner.plan(ts_millis, &rushee.pis_signup, available_brothers);

        if plan.first.is_some() || plan.second.is_some() {
            if persist_assignment(collection, rushee, &plan).await {
                assignments_made += 1;
            }

            // A partial assignment still counts as a failed slot, regardless of write outcome.
            if plan.still_missing_first || plan.still_missing_second {
                assignment_failures += 1;
            }
        } else if plan.still_missing_first || plan.still_missing_second {
            assignment_failures += 1;
        }
    }

    AssignmentCounts {
        assignments_made,
        assignment_failures,
    }
}
