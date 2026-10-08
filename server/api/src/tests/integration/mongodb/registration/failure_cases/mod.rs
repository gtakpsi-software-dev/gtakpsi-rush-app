use axum::Json;
use bson::{doc, DateTime};
use serde_json::json;

use super::super::fixtures::{add_slot, capacity, path, signup_payload, stored_rushee, GTID, SLOT};
use crate::{controllers::rushee, storage::db};

mod reschedule;
mod signup;

pub(super) use reschedule::{
    check_reschedule_missing_rushee_and_old_slot, check_reschedule_new_slot_write_failure,
    check_reschedule_old_slot_write_failure, check_reschedule_write_failure,
};
pub(super) use signup::check_signup_insert_failure;
