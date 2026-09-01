use bson::DateTime;
use serde::{Deserialize, Serialize};

use super::{misc::RushNight, pis::{PISQuestion, PISSignup, PISTimeslot}};

#[derive(Debug, Serialize, Deserialize)]
pub struct RusheeEdit {
    pub field: String,
    pub new_value: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Rating {
    pub name: String,
    pub value: f32
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StrippedRushee {
    pub name: String,
    pub first_name: String,
    pub last_name: String,
    pub gtid: String,
    pub major: String,
    pub ratings: Vec<Rating>,
    pub image_url: String,
    pub class: String,
    pub email: String,
    pub pronouns: String,
    pub attendance: Vec<RushNight>,
    pub registration_order: i32,  // Sequential number based on signup order
    pub pis_timeslot: Option<bson::DateTime>,
    pub interactions_by_night: Vec<NightInteractionSummary>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NightInteractionSummary {
    pub night_index: i32,
    pub name: String,
    pub interactions: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PisResponse {
    pub question: String,
    pub answer: String,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Comment {
    pub brother_id: String,
    pub brother_name: String,
    pub comment: String,
    pub ratings: Vec<Rating>,
    pub night: RushNight,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IncomingComment {
    pub brother_id: String,
    pub brother_name: String,
    pub comment: String,
    pub ratings: Vec<Rating>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IncomingRushee {
    pub first_name: String,
    pub last_name: String,
    pub housing: String,
    pub phone_number: String,
    pub email: String,
    pub gtid: String,
    pub major: String,
    pub class: String,
    pub pronouns: String,
    pub image_url: String,
    pub exposure: String,
    pub pis_meeting_id: String,
    pub pis_timeslot: String,
    pub pis_link: String,
    pub flex_window: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RusheeModel {
    pub first_name: String,
    pub last_name: String,
    pub housing: String,
    pub phone_number: String,
    pub email: String,
    pub gtid: String,
    pub major: String,
    pub class: String, 
    pub pronouns: String,
    pub image_url: String,
    pub exposure: String,
    pub pis_meeting_id: String,
    pub pis_timeslot: DateTime,
    pub pis_link: String,
    pub cloud: String,
    #[serde(default = "default_sorting_status")]
    pub sorting_status: String,
    #[serde(default)]
    pub sorting_notes: String,
    #[serde(default)]
    pub sorting_tags: Vec<String>,
    #[serde(default = "default_sorting_order")]
    pub sorting_order: i32,
    #[serde(default)]
    pub notes_updated_at: Option<DateTime>,
    #[serde(default)]
    pub notes_updated_by: Option<String>,
    #[serde(default)]
    pub status_updated_at: Option<DateTime>,
    #[serde(default)]
    pub status_updated_by: Option<String>,
    #[serde(default)]
    pub rush_number: Option<i32>,
    pub pis: Vec<PisResponse>,
    pub comments: Vec<Comment>,
    pub attendance: Vec<RushNight>,
    pub ratings: Vec<Rating>,
    pub access_code: String,
    pub pis_signup: PISSignup,
    pub flex_window: bool,
    /// The randomly-drawn category questions assigned to this rushee for their PIS,
    /// persisted the first time they're generated (5 min before pis_timeslot) so the
    /// same set is shown on every subsequent load rather than re-rolled.
    #[serde(default)]
    pub assigned_pis_questions: Option<Vec<PISQuestion>>,
    #[serde(default, skip_deserializing)]
    pub interactions_by_night: Vec<NightInteractionSummary>,
}

fn default_sorting_status() -> String {
    "UNSORTED".to_string()
}

fn default_sorting_order() -> i32 {
    0
}

#[derive(Debug, Serialize, Deserialize)]
pub enum VoteOption {
    NotVoted,
    Yes,
    No,
    Abstain
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IncomingRusheeVote {
    pub brother_id: String, // gtid
    pub first_name: String,
    pub last_name: String,
    pub vote: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RusheeVote {
    pub brother_id: String, // gtid
    pub first_name: String,
    pub last_name: String,
    pub vote: VoteOption,
}
