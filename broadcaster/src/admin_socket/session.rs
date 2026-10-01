use crate::clients::ClientList;
use crate::handlers::SocketRole;
use crate::session::handle_socket;
use axum::{
    extract::{ws::WebSocketUpgrade, ConnectInfo, Path},
    response::IntoResponse,
};
use std::{net::SocketAddr, sync::atomic::AtomicUsize};

static NEXT_CLIENT_ID: AtomicUsize = AtomicUsize::new(1);

pub async fn ws_handler(
    Path(id): Path<String>,
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    clients: ClientList,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| {
        handle_socket(
            socket,
            addr,
            clients,
            Some(id),
            &NEXT_CLIENT_ID,
            SocketRole::Admin,
            super::snapshot::load_initial_messages,
        )
    })
}
