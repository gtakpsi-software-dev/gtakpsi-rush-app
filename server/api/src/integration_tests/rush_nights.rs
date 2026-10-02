use axum::Json;
use bson::{doc, DateTime};
use serde_json::json;

use super::fixtures::{reset, SLOT};
use crate::{
    controllers::admin,
    models::misc::{IncomingRushNight, RushNight},
    storage::db,
};

pub async fn check_contracts() {
    reset().await;
    let collection = db::get_rush_nights_client().await;
    let time = DateTime::parse_rfc3339_str(SLOT).unwrap();

    assert_eq!(
        admin::add_rush_night(Json(IncomingRushNight {
            time: SLOT.to_string(),
            name: "Night 1".to_string(),
        }))
        .await
        .unwrap()
        .0,
        json!({"status": "success", "message": "successfully added rush night"})
    );
    assert_eq!(collection.count_documents(doc! {}).await.unwrap(), 1);

    let wrong_time = DateTime::parse_rfc3339_str("2030-01-02T18:00:00Z").unwrap();
    assert_eq!(
        admin::delete_rush_night(Json(RushNight {
            time: wrong_time,
            name: "Night 1".to_string(),
        }))
        .await
        .unwrap()
        .0,
        json!({"status": "success", "message": "successfully deleted rush night"})
    );
    assert_eq!(collection.count_documents(doc! {}).await.unwrap(), 1);

    let delete = Json(RushNight {
        time,
        name: "Different name".to_string(),
    });
    assert_eq!(
        admin::delete_rush_night(delete).await.unwrap().0,
        json!({"status": "success", "message": "successfully deleted rush night"})
    );
    assert_eq!(collection.count_documents(doc! {}).await.unwrap(), 0);
}
