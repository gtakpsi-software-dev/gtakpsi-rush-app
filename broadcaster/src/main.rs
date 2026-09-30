mod voter_socket;
mod admin_socket;
mod db;
mod clients;

#[cfg(test)]
mod tests;

#[cfg(all(test, feature = "integration-tests"))]
mod integration_tests;

use axum::{routing::get, Router};
use std::{env, net::SocketAddr, sync::Arc};
use voter_socket::{ws_handler, spawn_pubsub_listener};
use clients::ClientList;

use dotenvy::dotenv;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let clients: ClientList = Arc::new(dashmap::DashMap::new());
    let admins: ClientList = Arc::new(dashmap::DashMap::new());

    // Start background pubsub listeners
    spawn_pubsub_listener(clients.clone()).await;
    admin_socket::spawn_pubsub_listener(admins.clone()).await;

    let app = Router::new()

        .route("/", get(|| async { "ok" })) // health check
        .route(
            "/voter/:id",
            get({
                let clients = clients.clone();
                move |path, ws, addr| ws_handler(path, ws, addr, clients)
            }),
        )
        .route(
            "/admin/:id",
            get({
                let admins = admins.clone();
                move |path, ws, addr| admin_socket::ws_handler(path, ws, addr, admins)
            }),
        );


    let port: u16 = env::var("PORT").ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(4000);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("Broadcaster listening on 0.0.0.0:{port}");
    axum::Server::bind(&addr)
        .serve(app.into_make_service_with_connect_info::<SocketAddr>())
        .await
        .unwrap();
}
