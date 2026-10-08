use bson::doc;
use serde_json::json;

use super::*;

// Verify strict export failures and tolerant PIS schedule output for malformed rushees.
pub(super) async fn check_malformed_rushee() {
    reset().await;
    register().await;
    // The number and personal-info exports reject malformed rows, while the
    // PIS schedule export skips them. Keep those response contracts distinct.
    db::get_mongo_client()
        .await
        .database("rush-app")
        .collection::<bson::Document>("rushees")
        .insert_one(doc! { "gtid": "malformed", "first_name": "Incomplete" })
        .await
        .unwrap();

    let expected_error = json!({
        "status": "error", "message": "Error reading rushee data"
    });
    assert_eq!(
        admin::export_rushee_numbers().await.unwrap().0,
        expected_error
    );
    assert_eq!(
        admin::export_rushee_personal_info().await.unwrap().0,
        expected_error
    );

    let schedule = admin::export_pis_with_brothers().await.unwrap().0;
    assert_eq!(schedule["status"], "success");
    assert_eq!(schedule["payload"].as_array().unwrap().len(), 1);
    assert_eq!(schedule["payload"][0]["rushee_name"], "Test Rushee");
}
