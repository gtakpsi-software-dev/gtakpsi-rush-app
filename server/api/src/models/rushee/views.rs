use serde::{Deserialize, Serialize};

use super::{Rating, RusheeModel};
use crate::models::misc::RushNight;

/// Safe subset of a rushee's own record for the self-service rushee page
/// (`/rushee/:gtid/:link`). Deliberately excludes comments, sorting notes,
/// sorting status, ratings, and the access code itself — fields brothers
/// write about the rushee that the rushee should never see.
#[derive(Debug, Serialize, Deserialize)]
pub struct RusheeSelfView {
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
    pub attendance: Vec<RushNight>,
    pub pis_timeslot: bson::DateTime,
}

impl From<RusheeModel> for RusheeSelfView {
    fn from(r: RusheeModel) -> Self {
        RusheeSelfView {
            first_name: r.first_name,
            last_name: r.last_name,
            housing: r.housing,
            phone_number: r.phone_number,
            email: r.email,
            gtid: r.gtid,
            major: r.major,
            class: r.class,
            pronouns: r.pronouns,
            image_url: r.image_url,
            attendance: r.attendance,
            pis_timeslot: r.pis_timeslot,
        }
    }
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
    pub registration_order: i32, // Sequential number based on signup order
    pub pis_timeslot: Option<bson::DateTime>,
    pub interactions_by_night: Vec<NightInteractionSummary>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NightInteractionSummary {
    pub night_index: i32,
    pub name: String,
    pub interactions: Option<i32>,
}
