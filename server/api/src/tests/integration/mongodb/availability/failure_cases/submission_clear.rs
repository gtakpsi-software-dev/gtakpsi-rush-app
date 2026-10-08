use bson::doc;
use serde_json::json;

use super::{admin, db, reset};

// Verify that a failed submission clear stops before replacing form status.
pub(super) async fn check_rejected_submission_clear() {
    reset().await;
    assert_eq!(
        admin::send_pis_availability_form().await.unwrap().0["status"],
        "success"
    );
    let original_status = admin::get_pis_availability_form_status().await.unwrap().0;

    let database = db::get_mongo_client().await.database("rush-app");
    let submissions = db::get_brother_pis_availability_collection().await;
    submissions.drop().await.unwrap();
    // A read-only view makes the submission clear fail before form replacement.
    database
        .run_command(doc! {
            "create": "brother-pis-availability", "viewOn": "rushees", "pipeline": []
        })
        .await
        .unwrap();

    assert_eq!(
        admin::clear_and_resend_pis_availability_form()
            .await
            .unwrap()
            .0,
        json!({"status": "error", "message": "Failed to clear availability submissions"})
    );
    assert_eq!(
        admin::get_pis_availability_form_status().await.unwrap().0,
        original_status
    );
    submissions.drop().await.unwrap();
}
