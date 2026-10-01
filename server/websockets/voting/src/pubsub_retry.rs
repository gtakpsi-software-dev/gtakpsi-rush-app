use crate::clients::ClientMap;
use std::{error::Error, future::Future, time::Duration};

type ListenerResult = Result<(), Box<dyn Error + Send + Sync>>;

pub(crate) fn spawn_reconnecting_listener<F, Fut>(clients: ClientMap, role: &'static str, run: F)
where
    F: FnMut(ClientMap) -> Fut + Send + 'static,
    Fut: Future<Output = ListenerResult> + Send + 'static,
{
    tokio::spawn(run_reconnecting_listener(clients, role, run));
}

async fn run_reconnecting_listener<F, Fut>(clients: ClientMap, role: &str, mut run: F)
where
    F: FnMut(ClientMap) -> Fut,
    Fut: Future<Output = ListenerResult>,
{
    loop {
        println!("🔄 {role} PubSub: Connecting to Redis...");

        match run(clients.clone()).await {
            Ok(_) => println!("⚠️ {role} PubSub: Stream ended unexpectedly, reconnecting..."),
            Err(error) => println!("❌ {role} PubSub error: {error}, reconnecting in 3s..."),
        }

        // Delay retries after both errors and ended streams to avoid a Redis reconnect loop.
        tokio::time::sleep(Duration::from_secs(3)).await;
    }
}

#[cfg(test)]
mod tests {
    use super::run_reconnecting_listener;
    use crate::clients::ClientMap;
    use dashmap::DashMap;
    use std::{sync::Arc, time::Duration};
    use tokio::sync::mpsc;

    async fn assert_retry_delay(ends_normally: bool) {
        let clients: ClientMap = Arc::new(DashMap::new());
        let expected_clients = clients.clone();
        let (tx, mut attempts) = mpsc::unbounded_channel();
        let task = tokio::spawn(run_reconnecting_listener(
            clients,
            "Test",
            move |provided| {
                assert!(Arc::ptr_eq(&provided, &expected_clients));
                let tx = tx.clone();
                async move {
                    tx.send(()).unwrap();
                    if ends_normally {
                        Ok(())
                    } else {
                        Err("disconnected".into())
                    }
                }
            },
        ));

        tokio::task::yield_now().await;
        assert!(attempts.try_recv().is_ok());
        tokio::time::advance(Duration::from_millis(2999)).await;
        tokio::task::yield_now().await;
        assert!(attempts.try_recv().is_err());

        tokio::time::advance(Duration::from_millis(1)).await;
        tokio::task::yield_now().await;
        assert!(attempts.try_recv().is_ok());
        task.abort();
    }

    #[tokio::test(start_paused = true)]
    async fn errors_retry_only_after_the_existing_three_second_delay() {
        assert_retry_delay(false).await;
    }

    #[tokio::test(start_paused = true)]
    async fn ended_streams_retry_only_after_the_existing_three_second_delay() {
        assert_retry_delay(true).await;
    }
}
