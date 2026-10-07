use axum::extract::ws::{Message, WebSocket};
use futures_util::{stream::SplitStream, StreamExt};
use tokio::sync::mpsc;

#[derive(Clone, Copy)]
pub(crate) enum SocketRole {
    Admin,
    Voter,
}

impl SocketRole {
    pub(crate) fn label(self) -> &'static str {
        match self {
            Self::Admin => "Admin",
            Self::Voter => "Voter",
        }
    }
}

pub(crate) async fn handle_incoming_frames(
    mut receiver: SplitStream<WebSocket>,
    tx: mpsc::UnboundedSender<Message>,
    id: usize,
    role: SocketRole,
) {
    while let Some(msg) = receiver.next().await {
        match msg {
            Ok(Message::Close(_)) => {
                match role {
                    SocketRole::Admin => println!("Client {id} sent close"),
                    SocketRole::Voter => println!("🔒 Client {id} sent close message"),
                }
                break;
            }
            Ok(Message::Ping(data)) => {
                // INVARIANT: clients currently receive two Pong frames per Ping.
                if tx.send(Message::Pong(data)).is_err() {
                    println!("Failed to send pong to client {id}");
                    break;
                }
            }
            Ok(Message::Text(_)) | Ok(Message::Binary(_)) => {}
            Ok(Message::Pong(_)) => {}
            Err(error) => {
                match role {
                    SocketRole::Admin => println!("WebSocket error for client {id}: {error}"),
                    SocketRole::Voter => {
                        println!("❌ WebSocket error for client {id}: {error}")
                    }
                }
                break;
            }
        }
    }
}
