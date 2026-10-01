use bson::{doc, DateTime};
use serde_json::json;

use super::fixtures::*;
use crate::controllers::{admin, db};

pub async fn check_contracts() {
    reset().await;
    register().await;

    let mut earlier = stored_rushee().await;
    earlier.first_name = "Earlier".to_string();
    earlier.last_name = "Interview".to_string();
    earlier.gtid = "900000002".to_string();
    earlier.pis_timeslot = DateTime::parse_rfc3339_str("2029-01-01T18:00:00Z").unwrap();
    earlier.pis_signup.first_brother_first_name = "First".to_string();
    earlier.pis_signup.first_brother_last_name = "Brother".to_string();
    db::get_rushee_client()
        .await
        .insert_one(earlier)
        .await
        .unwrap();

    let numbers = admin::export_rushee_numbers().await.unwrap().0;
    assert_eq!(numbers["status"], "success");
    assert_eq!(numbers["payload"].as_array().unwrap().len(), 2);
    assert_eq!(
        numbers["payload"][0],
        json!({
            "rushee_number": "001", "name": "Test Rushee", "gtid": GTID
        })
    );
    assert_eq!(
        numbers["payload"][1],
        json!({
            "rushee_number": "002", "name": "Earlier Interview", "gtid": "900000002"
        })
    );

    let personal = admin::export_rushee_personal_info().await.unwrap().0;
    assert_eq!(personal["status"], "success");
    assert_eq!(
        personal["payload"][0],
        json!({
            "first_name": "Test", "last_name": "Rushee", "gtid": GTID,
            "email": "test@example.invalid", "phone_number": "(404) 555-0100",
            "housing": "Campus", "major": "Business", "class": "First Year",
            "pronouns": "they/them", "exposure": "Event"
        })
    );

    let schedule = admin::export_pis_with_brothers().await.unwrap().0;
    assert_eq!(schedule["status"], "success");
    assert_eq!(schedule["payload"].as_array().unwrap().len(), 2);
    assert_eq!(schedule["payload"][0]["rushee_name"], "Earlier Interview");
    assert_eq!(schedule["payload"][0]["brother_1"], "First Brother");
    assert_eq!(schedule["payload"][0]["brother_2"], "none none");
    assert_eq!(schedule["payload"][1]["rushee_name"], "Test Rushee");
    assert_eq!(
        schedule["payload"][0]["timeslot"],
        json!(DateTime::parse_rfc3339_str("2029-01-01T18:00:00Z").unwrap())
    );
    assert_eq!(
        db::get_rushee_client()
            .await
            .count_documents(doc! {})
            .await
            .unwrap(),
        2
    );
    println!("admin export number, PII, and PIS schedule contracts passed");
}
