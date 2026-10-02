mod failure_cases;

use axum::{extract::Path, Json};
use bson::doc;
use serde_json::json;

use super::fixtures::{path, register, reset, stored_rushee};
use crate::{
    controllers::admin,
    models::{misc::IncomingBrotherName, pis::IncomingPISSignup},
    storage::db,
};

fn brother(first: &str, last: &str) -> Json<IncomingPISSignup> {
    Json(IncomingPISSignup {
        brother_first_name: first.to_string(),
        brother_last_name: last.to_string(),
    })
}

async fn assigned_rushees(first: &str, last: &str) -> serde_json::Value {
    admin::get_brother_pis(Json(IncomingBrotherName {
        first_name: first.to_string(),
        last_name: last.to_string(),
    }))
    .await
    .unwrap()
    .0
}

pub async fn check_contracts() {
    reset().await;
    register().await;

    let first = admin::brother_pis_sign_up(path(), brother("Alex", "Brother"))
        .await
        .unwrap()
        .0;
    assert_eq!(
        first,
        json!({
            "status": "success", "message": "Successfully registered!"
        })
    );
    let stored = stored_rushee().await;
    assert_eq!(stored.pis_signup.first_brother_first_name, "Alex");
    assert_eq!(stored.pis_signup.first_brother_last_name, "Brother");
    assert_eq!(stored.pis_signup.second_brother_first_name, "none");

    let duplicate = admin::brother_pis_sign_up(path(), brother("Alex", "Brother"))
        .await
        .unwrap()
        .0;
    assert_eq!(
        duplicate,
        json!({
            "status": "error", "message": "Brother Alex Brother has already registered for this PIS."
        })
    );
    assert_eq!(
        stored_rushee().await.pis_signup.second_brother_first_name,
        "none"
    );

    let second = admin::brother_pis_sign_up(path(), brother("Bea", "Brother"))
        .await
        .unwrap()
        .0;
    assert_eq!(
        second,
        json!({
            "status": "success", "message": "Successfully registered for PIS!"
        })
    );
    let stored = stored_rushee().await;
    assert_eq!(stored.pis_signup.second_brother_first_name, "Bea");
    assert_eq!(stored.pis_signup.second_brother_last_name, "Brother");

    for first_name in ["Alex", "Bea"] {
        let assigned = assigned_rushees(first_name, "Brother").await;
        assert_eq!(assigned["status"], "success");
        let payload = assigned["payload"].as_array().unwrap();
        assert_eq!(payload.len(), 1);
        assert_eq!(payload[0]["gtid"], super::fixtures::GTID);
        assert_eq!(payload[0]["name"], "Test Rushee");
        assert_eq!(payload[0]["registration_order"], 0);
        assert!(payload[0]["pis_timeslot"].is_object());
        assert!(payload[0]["interactions_by_night"].is_array());
    }
    for (first_name, last_name) in [("alex", "Brother"), ("Alex", "Other")] {
        let assigned = assigned_rushees(first_name, last_name).await;
        assert_eq!(assigned, json!({ "status": "success", "payload": [] }));
    }

    // A malformed rushee after a matching one rejects the whole brother listing.
    let raw_collection = db::get_mongo_client()
        .await
        .database("rush-app")
        .collection::<bson::Document>("rushees");
    let malformed = raw_collection
        .insert_one(doc! {"gtid": "malformed", "first_name": "Incomplete"})
        .await
        .unwrap();
    assert_eq!(
        assigned_rushees("Alex", "Brother").await,
        json!({
            "status": "error",
            "message": "there was an error pushing the stripped rushee to the array"
        })
    );
    raw_collection
        .delete_one(doc! {"_id": malformed.inserted_id})
        .await
        .unwrap();

    let full = admin::brother_pis_sign_up(path(), brother("Cam", "Brother"))
        .await
        .unwrap()
        .0;
    assert_eq!(
        full,
        json!({
            "status": "error", "message": "Two brothers (Alex Brother and Bea Brother) are already signed up"
        })
    );
    assert_eq!(
        stored_rushee().await.pis_signup.second_brother_first_name,
        "Bea"
    );

    let missing =
        admin::brother_pis_sign_up(Path("missing-gtid".to_string()), brother("Cam", "Brother"))
            .await
            .unwrap()
            .0;
    assert_eq!(
        missing,
        json!({
        "status": "error", "message": "The rushee with GTID missing-gtid does not exist"
        })
    );

    reset().await;
    register().await;
    db::get_rushee_collection()
        .await
        .update_one(
            doc! { "gtid": super::fixtures::GTID },
            doc! { "$set": { "pis_signup.first_brother_first_name": "Alex" } },
        )
        .await
        .unwrap();
    let partial = admin::brother_pis_sign_up(path(), brother("Alex", "Brother"))
        .await
        .unwrap()
        .0;
    assert_eq!(
        partial,
        json!({ "status": "success", "message": "Successfully registered for PIS!" })
    );
    let stored = stored_rushee().await;
    assert_eq!(stored.pis_signup.first_brother_first_name, "Alex");
    assert_eq!(stored.pis_signup.first_brother_last_name, "none");
    assert_eq!(stored.pis_signup.second_brother_first_name, "Alex");
    assert_eq!(stored.pis_signup.second_brother_last_name, "Brother");

    failure_cases::check_malformed_signup_target().await;
    failure_cases::check_signup_write_failures().await;

    println!("brother PIS signup and partial-slot contracts passed");
}
