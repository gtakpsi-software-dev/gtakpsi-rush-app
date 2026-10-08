use axum::{extract::Path, Json};
use bson::{doc, DateTime};
use serde_json::json;

use super::payload;
use crate::{
    controllers::rushee,
    models::rush_nights::RushNight,
    storage::db,
    tests::integration::mongodb::fixtures::{path, register, reset, GTID},
};

pub(super) async fn check_contracts() {
    reset().await;
    // Put an incomplete rushee first so the query must continue to a valid comment.
    db::get_mongo_client()
        .await
        .database("rush-app")
        .collection::<bson::Document>("rushees")
        .insert_one(doc! {"gtid": "malformed"})
        .await
        .unwrap();
    register().await;
    db::get_rush_nights_collection()
        .await
        .insert_one(RushNight {
            name: "Night 1".to_string(),
            time: DateTime::from_millis(DateTime::now().timestamp_millis() - 3_600_000),
        })
        .await
        .unwrap();
    assert_eq!(
        rushee::post_comment(path(), Json(payload("Alex", 4.0)))
            .await
            .unwrap()
            .0["status"],
        "success"
    );

    let comments = rushee::get_brother_comments(Path("Alex".to_string()))
        .await
        .unwrap()
        .0;
    assert_eq!(comments["status"], "success");
    assert_eq!(comments["payload"].as_array().unwrap().len(), 1);
    assert_eq!(comments["payload"][0]["rushee"]["gtid"], GTID);
    assert_eq!(
        comments["payload"][0]["comments"].as_array().unwrap().len(),
        1
    );
    assert_eq!(
        comments["payload"][0]["comments"][0]["brother_name"],
        "Alex"
    );
    assert_eq!(
        rushee::get_brother_comments(Path("Nobody".to_string()))
            .await
            .unwrap()
            .0["payload"],
        json!([])
    );
}
