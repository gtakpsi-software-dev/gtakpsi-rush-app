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

pub async fn get_rushee_collection() -> Collection<RusheeModel> {
    let client = get_mongo_client().await;
    client.database(DATABASE_NAME).collection("rushees")
}

pub async fn get_pis_questions_collection() -> Collection<PISQuestion> {
    let client = get_mongo_client().await;
    client.database(DATABASE_NAME).collection("pis-questions")
}

pub async fn get_pis_timeslots_collection() -> Collection<PISTimeslot> {
    let client = get_mongo_client().await;
    client.database(DATABASE_NAME).collection("pis-timeslots")
}

pub async fn get_rush_nights_collection() -> Collection<RushNight> {
    let client = get_mongo_client().await;
    client.database(DATABASE_NAME).collection("rush-nights")
}

pub async fn get_pis_availability_form_status_collection() -> Collection<PISAvailabilityFormStatus>
{
    let client = get_mongo_client().await;
    client
        .database(DATABASE_NAME)
        .collection("pis-availability-form-status")
}

pub async fn get_brother_pis_availability_collection() -> Collection<BrotherPISAvailability> {
    let client = get_mongo_client().await;
    client
        .database(DATABASE_NAME)
        .collection("brother-pis-availability")
}

pub async fn get_rush_app_status_collection() -> Collection<RushAppStatus> {
    let client = get_mongo_client().await;
    client.database(DATABASE_NAME).collection("rush-app-status")
}

pub async fn get_comment_visibility_settings_collection() -> Collection<CommentVisibilitySettings> {
    let client = get_mongo_client().await;
    client
        .database(DATABASE_NAME)
        .collection("comment-visibility-settings")
}
