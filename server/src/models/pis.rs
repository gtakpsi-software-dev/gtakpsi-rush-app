use serde::{Deserialize, Serialize};
use bson::DateTime;

#[derive(Debug, Deserialize, Serialize)]
pub struct PISQuestion {
    pub question: String,
    pub question_type: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PISTimeslot {
    pub time: DateTime,
    pub num_available: i32,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PISTimeslotIncoming {
    pub time: String,
    pub change: i32,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PISSignup {
    pub time: DateTime,
    pub rushee_first_name: String,
    pub rushee_last_name: String,
    pub rushee_gtid: String,
    pub first_brother_first_name: String,
    pub first_brother_last_name: String,
    pub second_brother_first_name: String,
    pub second_brother_last_name: String,
    pub flex_window: bool,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct IncomingPISSignup {
    pub brother_first_name: String,
    pub brother_last_name: String,
}

// ========== PIS Availability System Models ==========

/// Tracks whether the PIS availability form is currently active
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct PISAvailabilityFormStatus {
    pub is_active: bool,
    pub sent_at: Option<DateTime>,
}

/// Stores a brother's PIS availability submission
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct BrotherPISAvailability {
    pub brother_uid: String,
    pub brother_email: String,
    pub brother_first_name: String,
    pub brother_last_name: String,
    pub available_timeslots: Vec<DateTime>,
    pub submitted_at: DateTime,
}

/// Incoming payload for brother availability submission
#[derive(Debug, Deserialize, Serialize)]
pub struct IncomingBrotherAvailability {
    pub brother_uid: String,
    pub brother_email: String,
    pub brother_first_name: String,
    pub brother_last_name: String,
    pub available_timeslots: Vec<String>, // ISO strings
}

// ========== App Disable Status ==========

/// Tracks whether the rush app is disabled for brothers
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct AppDisableStatus {
    pub disabled_for_regular_brothers: bool,
    pub disabled_for_bidcom_brothers: bool,
    pub disabled_at: Option<DateTime>,
    pub disabled_by: Option<String>,
    pub message: Option<String>,
}