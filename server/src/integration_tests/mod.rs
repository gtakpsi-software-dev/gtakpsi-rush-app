mod assignments;
mod availability;
mod brother_pis;
mod comments;
mod fixtures;
mod interviews;
mod profile;
mod registration;
mod sorting;

use crate::controllers::db;
use mongodb::{bson::doc, Client};
use std::{env, sync::Arc};

#[tokio::test]
async fn database_contracts() {
    let uri = env::var("RUSH_TEST_MONGO_URL").expect("Run scripts/testing/api-integration.sh");
    let run_id = env::var("RUSH_TEST_RUN_ID").expect("Missing isolated-container run ID");
    assert!(uri.starts_with("mongodb://127.0.0.1:"));
    let client = Client::with_uri_str(uri).await.unwrap();

    // INVARIANT: destructive fixture resets require the fresh container's marker.
    // A localhost address alone is insufficient because it could hold real data.
    let guard = client
        .database("rush-app")
        .collection::<mongodb::bson::Document>("_integration_guard")
        .find_one(doc! { "runId": run_id, "isolated": true })
        .await
        .unwrap();
    assert!(guard.is_some(), "Refusing to reset an unmarked database");
    db::MONGO_CLIENT.set(Arc::new(client)).unwrap();

    // The MongoDB client's background tasks share this runtime across scenarios.
    registration::check_contracts().await;
    profile::check_contracts().await;
    interviews::check_contracts().await;
    comments::check_contracts().await;
    brother_pis::check_contracts().await;
    sorting::check_contracts().await;
    assignments::check_contracts().await;
    availability::check_contracts().await;
}
