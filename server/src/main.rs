use dotenv::dotenv;
use std::net::SocketAddr;
use std::{env, fs, sync::Arc};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod controllers;
mod middlewares;
mod models;
mod routes;

#[cfg(all(test, feature = "integration-tests"))]
mod integration_tests;

#[tokio::main]
async fn main() {
    // Initialize tracing for logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "server=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Start crypto runtime, required to connect to redis instance
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("install rustls crypto provider");

    dotenv().ok();

    // Get port from environment variable (Railway sets PORT automatically)
    let port: u16 = env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse()
        .expect("PORT must be a valid number");

    let project_id = env::var("FIREBASE_PROJECT_ID").expect("FIREBASE_PROJECT_ID not set");
    let allowlist = env::var("ADMIN_ALLOWLIST_EMAILS").ok();
    // Prefer inline JSON env, fallback to file path if provided.
    let service_account = env::var("FIREBASE_SERVICE_ACCOUNT_JSON")
        .ok()
        .and_then(|inline| serde_json::from_str::<middlewares::auth::ServiceAccount>(&inline).ok())
        .or_else(|| {
            env::var("FIREBASE_SERVICE_ACCOUNT_PATH")
                .ok()
                .and_then(|path| fs::read_to_string(path).ok())
                .and_then(|contents| {
                    serde_json::from_str::<middlewares::auth::ServiceAccount>(&contents).ok()
                })
        });

    let firebase_auth = Arc::new(middlewares::auth::FirebaseAuth::new(
        project_id,
        allowlist,
        service_account,
    ));

    let app = routes::create_router(firebase_auth);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("🚀 Server starting on http://{}", addr);

    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .expect("Failed to start server");
}
