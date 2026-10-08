mod admin_socket;
mod app;
mod clients;
mod db;
mod handlers;
mod protocol;
mod pubsub_retry;
mod session;
mod snapshot;
mod voter_socket;

#[cfg(test)]
mod tests;

use clients::ClientMap;
use std::{env, net::SocketAddr, sync::Arc};
use voter_socket::spawn_pubsub_listener;

// Starts the admin and voter Redis listeners, then serves voting WebSocket routes.
#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let voters: ClientMap = Arc::new(dashmap::DashMap::new());
    let admins: ClientMap = Arc::new(dashmap::DashMap::new());

    spawn_pubsub_listener(voters.clone()).await;
    admin_socket::spawn_pubsub_listener(admins.clone()).await;

    let app = app::create_router(voters, admins);

    let port: u16 = env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(4000);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("Broadcaster listening on 0.0.0.0:{port}");
    axum::Server::bind(&addr)
        .serve(app.into_make_service_with_connect_info::<SocketAddr>())
        .await
        .unwrap();
}
