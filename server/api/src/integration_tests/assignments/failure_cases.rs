use bson::doc;
use serde_json::json;

use super::*;

pub(super) async fn check_clear_failure() {
    reset().await;
    register().await;
    add_availability("Ada", "Lovelace").await;
    assert_eq!(
        admin::auto_assign_pis_brothers().await.unwrap().0["status"],
        "success"
    );
    let assigned = stored_rushee().await.pis_signup;
    assert_eq!(assigned.first_brother_first_name, "Ada");

    let database = db::get_mongo_client().await.database("rush-app");
    // Reject the reset so the error response and intact assignment stay pinned.
    database
        .run_command(doc! {
            "collMod": "rushees",
            "validator": { "pis_signup.first_brother_first_name": "Ada" }
        })
        .await
        .unwrap();
    assert_eq!(
        admin::clear_pis_assignments().await.unwrap().0,
        json!({"status": "error", "message": "Failed to clear assignments"})
    );
    let stored = stored_rushee().await.pis_signup;
    assert_eq!(
        stored.first_brother_first_name,
        assigned.first_brother_first_name
    );
    assert_eq!(
        stored.first_brother_last_name,
        assigned.first_brother_last_name
    );
    assert_eq!(
        stored.second_brother_first_name,
        assigned.second_brother_first_name
    );
    assert_eq!(
        stored.second_brother_last_name,
        assigned.second_brother_last_name
    );
    database
        .run_command(doc! { "collMod": "rushees", "validator": {} })
        .await
        .unwrap();
}
