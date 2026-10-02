use bson::doc;
use serde_json::json;

use super::fixtures::{register, reset, GTID};
use crate::{controllers::rushee, storage::db};

pub async fn check_malformed_row_responses() {
    reset().await;
    register().await;
    db::get_mongo_client()
        .await
        .database("rush-app")
        .collection::<bson::Document>("rushees")
        .insert_one(doc! { "gtid": "malformed", "first_name": "Incomplete" })
        .await
        .unwrap();

    let expected = json!({
        "status": "error",
        "message": "there was an error pushing the stripped rushee to the array"
    });
    assert_eq!(rushee::get_rushees().await.unwrap().0, expected);
    assert_eq!(rushee::get_signup_timeslots().await.unwrap().0, expected);
    assert_eq!(
        db::get_rushee_client()
            .await
            .count_documents(doc! { "gtid": GTID })
            .await
            .unwrap(),
        1
    );
}
