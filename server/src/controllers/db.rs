use mongodb::{options::ClientOptions, Client, Collection};
use std::sync::Arc;
use std::env;
use redis::aio::ConnectionManager;
use tokio::sync::OnceCell;

use crate::models::{
    misc::RushNight, 
    pis::{PISQuestion, PISTimeslot, PISAvailabilityFormStatus, BrotherPISAvailability, AppDisableStatus}, 
    Rushee::RusheeModel
};

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

pub async fn get_redis_conn() -> Arc<ConnectionManager> {
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

/// DEPRECATED, Get a reference to the MongoDB client
pub fn get_client() -> Arc<Client> {
    MONGO_CLIENT
        .get()
        .expect("MongoDB client is not initialized. Call `get_mongo_client` first.")
        .clone()
}

pub async fn get_rushee_client() -> mongodb::Collection<RusheeModel> {
    let client = get_mongo_client().await;
    client.database("rush-app").collection("rushees")
}

pub async fn get_pis_questions_client() -> Collection<PISQuestion> {
    let client = get_mongo_client().await;
    client.database("rush-app").collection("pis-questions")
}

pub async fn get_pis_timeslots_client() -> Collection<PISTimeslot> {
    let client = get_mongo_client().await;
    client.database("rush-app").collection("pis-timeslots")
}

pub async fn get_rush_nights_client() -> Collection<RushNight> {
    let client = get_mongo_client().await;
    client.database("rush-app").collection("rush-nights")
}

pub async fn get_pis_availability_form_status_client() -> Collection<PISAvailabilityFormStatus> {
    let client = get_mongo_client().await;
    client.database("rush-app").collection("pis-availability-form-status")
}

pub async fn get_brother_pis_availability_client() -> Collection<BrotherPISAvailability> {
    let client = get_mongo_client().await;
    client.database("rush-app").collection("brother-pis-availability")
}

pub async fn get_app_disable_status_client() -> Collection<AppDisableStatus> {
    let client = get_mongo_client().await;
    client.database("rush-app").collection("app-disable-status")
}
