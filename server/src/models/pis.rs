use chrono::Date;
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