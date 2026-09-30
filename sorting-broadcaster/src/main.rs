use std::{env, net::SocketAddr};

mod app;
mod cleanup;
mod handlers;
mod protocol;
mod session;
mod state;

#[cfg(test)]
mod tests;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let state = state::new_state();
    tokio::spawn(cleanup::run(state.clone()));
    let app = app::create_router(state);

    let port: u16 = env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(4001);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("Sorting Broadcaster listening on 0.0.0.0:{}", port);

    axum::Server::bind(&addr)
        .serve(app.into_make_service_with_connect_info::<SocketAddr>())
        .await
        .unwrap();
}
