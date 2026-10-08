use bson::doc;

use super::super::fixtures::{register, reset, GTID};
use crate::{controllers::admin, storage::db};

// Verify that malformed rows neither appear on the board nor consume fallback numbers.
pub(super) async fn check_malformed_rows() {
    reset().await;
    let raw_rushees = db::get_mongo_client()
        .await
        .database("rush-app")
        .collection::<bson::Document>("rushees");

    // Put the malformed row first so it cannot consume a fallback board number.
    raw_rushees
        .insert_one(doc! {"gtid": "malformed"})
        .await
        .unwrap();
    register().await;

    let admin_board = admin::get_sorting_rushees().await.unwrap().0;
    let public_board = admin::get_sorting_rushees_public().await.unwrap().0;
    assert_eq!(raw_rushees.count_documents(doc! {}).await.unwrap(), 2);
    for board in [&admin_board, &public_board] {
        assert_eq!(board["status"], "success");
        assert_eq!(board["payload"].as_array().unwrap().len(), 1);
        assert_eq!(board["payload"][0]["id"], GTID);
        assert_eq!(board["payload"][0]["sortingOrder"], 1);
    }
    assert_eq!(admin_board["payload"][0]["rushNumber"], 1);
    assert_eq!(public_board["payload"][0]["rushNumber"], 0);
}
