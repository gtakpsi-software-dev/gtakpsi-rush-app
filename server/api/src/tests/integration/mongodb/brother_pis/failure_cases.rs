use super::*;

pub(super) async fn check_malformed_signup_target() {
    reset().await;
    let collection = db::get_mongo_client()
        .await
        .database("rush-app")
        .collection::<bson::Document>("rushees");
    let gtid = path().0;
    collection
        .insert_one(doc! {"gtid": &gtid, "first_name": "Incomplete"})
        .await
        .unwrap();

    // A matching row that cannot decode must stop before choosing or writing a PIS slot.
    assert_eq!(
        admin::brother_pis_sign_up(path(), brother("Alex", "Brother"))
            .await
            .unwrap()
            .0,
        json!({"status": "error", "message": "Couldn't access the MongoDB database"})
    );
    let stored = collection
        .find_one(doc! {"gtid": &gtid})
        .await
        .unwrap()
        .unwrap();
    assert_eq!(stored.get_str("first_name").unwrap(), "Incomplete");
    assert!(!stored.contains_key("pis_signup"));
    assert_eq!(collection.count_documents(doc! {}).await.unwrap(), 1);
}

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
