use super::*;

pub(super) async fn check_signup_write_failures() {
    reset().await;
    register().await;
    let database = db::get_mongo_client().await.database("rush-app");
    // Reject the second name write to pin the current partial-signup result.
    database
        .run_command(doc! {
            "collMod": "rushees",
            "validator": { "pis_signup.first_brother_last_name": "none" }
        })
        .await
        .unwrap();
    let failed_last_name = admin::brother_pis_sign_up(path(), brother("Alex", "Brother"))
        .await
        .unwrap()
        .0;
    assert_eq!(
        failed_last_name,
        json!({"status": "error", "message": "Couldn't update the PIS Signup for last name"})
    );
    let stored = stored_rushee().await;
    assert_eq!(stored.pis_signup.first_brother_first_name, "Alex");
    assert_eq!(stored.pis_signup.first_brother_last_name, "none");
    assert_eq!(stored.pis_signup.second_brother_first_name, "none");
    database
        .run_command(doc! { "collMod": "rushees", "validator": {} })
        .await
        .unwrap();

    reset().await;
    register().await;
    // Reject the first write so neither signup name is changed.
    database
        .run_command(doc! {
            "collMod": "rushees",
            "validator": { "pis_signup.first_brother_first_name": "none" }
        })
        .await
        .unwrap();
    let failed_first_name = admin::brother_pis_sign_up(path(), brother("Alex", "Brother"))
        .await
        .unwrap()
        .0;
    assert_eq!(
        failed_first_name,
        json!({"status": "error", "message": "Couldn't update the PIS Signup for first name"})
    );
    let stored = stored_rushee().await;
    assert_eq!(stored.pis_signup.first_brother_first_name, "none");
    assert_eq!(stored.pis_signup.first_brother_last_name, "none");
    assert_eq!(stored.pis_signup.second_brother_first_name, "none");
    database
        .run_command(doc! { "collMod": "rushees", "validator": {} })
        .await
        .unwrap();
}
