use crate::{admin_socket, clients::ClientList, voter_socket};
use axum::{routing::get, Router};

pub fn create_router(voters: ClientList, admins: ClientList) -> Router {
    Router::new()
        .route("/", get(|| async { "ok" }))
        .route(
            "/voter/:id",
            get({
                let clients = voters.clone();
                move |path, ws, addr| voter_socket::ws_handler(path, ws, addr, clients)
            }),
        )
        .route(
            "/admin/:id",
            get({
                let admins = admins.clone();
                move |path, ws, addr| admin_socket::ws_handler(path, ws, addr, admins)
            }),
        )
}
