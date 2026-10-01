use axum::{extract::Path, Json};
use bson::doc;
use serde_json::json;

use super::fixtures::{path, register, reset, stored_rushee};
use crate::{
    controllers::{admin, db},
    models::pis::IncomingPISSignup,
};

fn brother(first: &str, last: &str) -> Json<IncomingPISSignup> {
    Json(IncomingPISSignup {
        brother_first_name: first.to_string(),
        brother_last_name: last.to_string(),
    })
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
    db::get_rushee_client()
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

    println!("brother PIS signup and partial-slot contracts passed");
}
