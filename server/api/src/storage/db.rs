use std::env;
use std::sync::Arc;

use mongodb::{options::ClientOptions, Client, Collection};
use redis::aio::ConnectionManager;
use tokio::sync::OnceCell;

use crate::models::{
    pis::{
        BrotherPISAvailability, CommentVisibilitySettings, PISAvailabilityFormStatus, PISQuestion,
        PISTimeslot, RushAppStatus,
    },
    rush_nights::RushNight,
    rushee::RusheeModel,
};

const DATABASE_NAME: &str = "rush-app";

pub static MONGO_CLIENT: OnceCell<Arc<Client>> = OnceCell::const_new();
pub static REDIS_CLIENT: OnceCell<Arc<ConnectionManager>> = OnceCell::const_new();

// Initialize the shared MongoDB client from MONGO_URL or reuse the cached client.
pub async fn get_mongo_client() -> Arc<Client> {
    MONGO_CLIENT
        .get_or_init(|| async {
            let uri = env::var("MONGO_URL").expect("MONGO_URL must be set");
            let client_options = ClientOptions::parse(&uri).await.unwrap();
            let client = Client::with_options(client_options).unwrap();
            Arc::new(client)
        })
        .await
        .clone()
}

// Initialize the shared Redis connection manager from REDIS_URL or reuse it.
pub async fn get_redis_manager() -> Arc<ConnectionManager> {
    REDIS_CLIENT
        .get_or_init(|| async {
            let url = env::var("REDIS_URL").expect("REDIS_URL must be set");
            let client = redis::Client::open(url).expect("Invalid Redis URL");
            let manager = ConnectionManager::new(client)
                .await
                .expect("Failed to connect to Redis");
            Arc::new(manager)
        })
        .await
        .clone()
}

// Return the typed rushee collection in the rush-app database.
pub async fn get_rushee_collection() -> Collection<RusheeModel> {
    let client = get_mongo_client().await;
    client.database(DATABASE_NAME).collection("rushees")
}

// Return the typed PIS question collection in the rush-app database.
pub async fn get_pis_questions_collection() -> Collection<PISQuestion> {
    let client = get_mongo_client().await;
    client.database(DATABASE_NAME).collection("pis-questions")
}

// Return the typed PIS timeslot collection in the rush-app database.
pub async fn get_pis_timeslots_collection() -> Collection<PISTimeslot> {
    let client = get_mongo_client().await;
    client.database(DATABASE_NAME).collection("pis-timeslots")
}

// Return the typed rush-night collection in the rush-app database.
pub async fn get_rush_nights_collection() -> Collection<RushNight> {
    let client = get_mongo_client().await;
    client.database(DATABASE_NAME).collection("rush-nights")
}

// Return the collection holding PIS availability form status.
pub async fn get_pis_availability_form_status_collection() -> Collection<PISAvailabilityFormStatus>
{
    let client = get_mongo_client().await;
    client
        .database(DATABASE_NAME)
        .collection("pis-availability-form-status")
}

// Return the collection holding brother PIS availability submissions.
pub async fn get_brother_pis_availability_collection() -> Collection<BrotherPISAvailability> {
    let client = get_mongo_client().await;
    client
        .database(DATABASE_NAME)
        .collection("brother-pis-availability")
}

// Return the collection holding rush application status.
pub async fn get_rush_app_status_collection() -> Collection<RushAppStatus> {
    let client = get_mongo_client().await;
    client.database(DATABASE_NAME).collection("rush-app-status")
}

// Return the collection holding comment visibility settings.
pub async fn get_comment_visibility_settings_collection() -> Collection<CommentVisibilitySettings> {
    let client = get_mongo_client().await;
    client
        .database(DATABASE_NAME)
        .collection("comment-visibility-settings")
}
