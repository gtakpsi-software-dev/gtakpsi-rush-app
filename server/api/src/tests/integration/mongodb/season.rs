use crate::{controllers::admin::reset_season, storage::db};
use mongodb::bson::{doc, Document};
use serde_json::json;

// Verify that season reset clears only its four collections and succeeds when repeated.
pub async fn check_contracts() {
    let client = db::get_mongo_client().await;
    let database = client.database("rush-app");
    let cleared = ["rushees", "rush-nights", "pis-timeslots", "pis-questions"];
    let retained = [
        "rush-app-status",
        "brother-pis-availability",
        "_integration_guard",
    ];
    for name in cleared.into_iter().chain(retained) {
        database
            .collection::<Document>(name)
            .insert_one(doc! {"season_reset_test": true})
            .await
            .unwrap();
    }
    assert_eq!(
        reset_season().await.unwrap().0,
        json!({"status": "success"})
    );
    for name in cleared {
        assert_eq!(
            database
                .collection::<Document>(name)
                .count_documents(doc! {})
                .await
                .unwrap(),
            0
        );
    }
    for name in retained {
        let collection = database.collection::<Document>(name);
        assert_eq!(
            collection
                .count_documents(doc! {"season_reset_test": true})
                .await
                .unwrap(),
            1
        );
        collection
            .delete_many(doc! {"season_reset_test": true})
            .await
            .unwrap();
    }
    // A second reset on empty collections must also succeed.
    assert_eq!(
        reset_season().await.unwrap().0,
        json!({"status": "success"})
    );
}
