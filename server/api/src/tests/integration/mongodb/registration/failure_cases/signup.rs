use super::*;

// Verify that a failed rushee insert retains the earlier timeslot reservation.
pub(in crate::tests::integration::mongodb::registration) async fn check_signup_insert_failure() {
    let new_gtid = "900000002";
    let before = capacity(SLOT).await;
    let database = db::get_mongo_client().await.database("rush-app");

    // Reject only the new rushee document after signup reserves a PIS slot.
    database
        .run_command(doc! {
            "collMod": "rushees",
            "validator": { "$jsonSchema": {
                "bsonType": "object",
                "properties": { "gtid": { "enum": [GTID] } }
            } }
        })
        .await
        .unwrap();
    let mut payload = signup_payload();
    payload["gtid"] = json!(new_gtid);
    assert_eq!(
        rushee::signup(Json(serde_json::from_value(payload).unwrap()))
            .await
            .unwrap()
            .0,
        json!({"status": "error", "message": "there was some error"})
    );
    assert_eq!(capacity(SLOT).await, before - 1);
    assert_eq!(
        db::get_rushee_collection()
            .await
            .count_documents(doc! {"gtid": new_gtid})
            .await
            .unwrap(),
        0
    );
    database
        .run_command(doc! { "collMod": "rushees", "validator": {} })
        .await
        .unwrap();
}
