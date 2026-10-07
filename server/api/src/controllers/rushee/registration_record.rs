use crate::models::{
    pis::PISSignup,
    rush_nights::RushNight,
    rushee::{Comment, IncomingRushee, PisResponse, Rating, RusheeModel},
};
use bson::DateTime;

pub(super) fn build_registration_record(
    payload: &IncomingRushee,
    pis_timeslot: DateTime,
    access_code: &str,
) -> RusheeModel {
    RusheeModel {
        first_name: payload.first_name.to_string(),
        last_name: payload.last_name.to_string(),
        housing: payload.housing.to_string(),
        phone_number: payload.phone_number.to_string(),
        email: payload.email.to_string(),
        gtid: payload.gtid.to_string(),
        major: payload.major.to_string(),
        class: payload.class.to_string(),
        pronouns: payload.pronouns.to_string(),
        image_url: payload.image_url.to_string(),
        exposure: payload.exposure.to_string(),
        pis_meeting_id: payload.pis_meeting_id.to_string(),
        pis_timeslot,
        pis_link: payload.pis_link.to_string(),
        cloud: "none".to_string(),
        pis: Vec::<PisResponse>::new(),
        comments: Vec::<Comment>::new(),
        attendance: Vec::<RushNight>::new(),
        ratings: Vec::<Rating>::new(),
        access_code: access_code.to_string(),
        pis_signup: PISSignup {
            time: pis_timeslot,
            rushee_first_name: payload.first_name.to_string(),
            rushee_last_name: payload.last_name.to_string(),
            rushee_gtid: payload.gtid.to_string(),
            first_brother_first_name: "none".to_string(),
            first_brother_last_name: "none".to_string(),
            second_brother_first_name: "none".to_string(),
            second_brother_last_name: "none".to_string(),
            flex_window: payload.flex_window,
        },
        flex_window: payload.flex_window,
        assigned_pis_questions: None,
        sorting_status: "UNSORTED".to_string(),
        sorting_notes: String::new(),
        sorting_tags: Vec::new(),
        sorting_order: 0,
        notes_updated_at: None,
        notes_updated_by: None,
        status_updated_at: None,
        status_updated_by: None,
        rush_number: None,
        interactions_by_night: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn registration_record_keeps_pis_shadow_fields_and_defaults() {
        let payload: IncomingRushee = serde_json::from_value(json!({
            "first_name": "Ada", "last_name": "Example", "housing": "Campus",
            "phone_number": "4045550100", "email": "ada@example.invalid",
            "gtid": "900000002", "major": "Business", "class": "First Year",
            "pronouns": "she/her", "image_url": "image", "exposure": "Event",
            "pis_meeting_id": "meeting", "pis_timeslot": "2030-01-01T18:00:00Z",
            "pis_link": "interview", "flex_window": true
        }))
        .unwrap();
        let slot = DateTime::parse_rfc3339_str("2030-01-01T18:00:00Z").unwrap();

        let record = build_registration_record(&payload, slot, "private-code");

        assert_eq!(record.first_name, "Ada");
        assert_eq!(record.pis_signup.rushee_first_name, "Ada");
        assert_eq!(record.pis_signup.rushee_gtid, "900000002");
        assert_eq!(record.pis_timeslot, record.pis_signup.time);
        assert!(record.flex_window && record.pis_signup.flex_window);
        assert_eq!(record.access_code, "private-code");
        assert_eq!(record.cloud, "none");
        assert_eq!(record.sorting_status, "UNSORTED");
        assert!(record.comments.is_empty());
        assert!(record.attendance.is_empty());
        assert!(record.ratings.is_empty());
        assert!(record.assigned_pis_questions.is_none());
    }
}
