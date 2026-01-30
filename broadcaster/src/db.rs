use redis::aio::ConnectionManager;
use std::env;
use std::sync::Arc;
use tokio::sync::OnceCell;
use tokio::time::{sleep, Duration};

pub static REDIS_CLIENT: OnceCell<Arc<ConnectionManager>> = OnceCell::const_new();

pub async fn get_redis_pubsub() -> redis::aio::PubSub {
    let url = env::var("REDIS_URL").unwrap_or_else(|_| {
        println!("⚠️ REDIS_URL not set, falling back to localhost");
        "redis://localhost:6379".to_string()
    });
    println!("🔗 Connecting to Redis for PubSub...");
    let client = redis::Client::open(url).expect("Invalid Redis URL");
    
    // Retry logic for Redis connection
    let mut attempts = 0;
    let max_attempts = 10;
    
    loop {
        attempts += 1;
        match client.get_async_connection().await {
            Ok(conn) => return conn.into_pubsub(),
            Err(e) => {
                if attempts >= max_attempts {
                    panic!("Failed to connect to Redis after {} attempts: {}", max_attempts, e);
                }
                println!("⏳ Redis connection attempt {}/{} failed: {}. Retrying in 2s...", attempts, max_attempts, e);
                sleep(Duration::from_secs(2)).await;
            }
        }
    }
}

pub async fn get_redis_conn() -> Arc<ConnectionManager> {
    REDIS_CLIENT
        .get_or_init(|| async {
            let url = env::var("REDIS_URL").unwrap_or_else(|_| {
                println!("⚠️ REDIS_URL not set, falling back to localhost");
                "redis://localhost:6379".to_string()
            });
            println!("🔗 Connecting to Redis for ConnectionManager...");
            let client = redis::Client::open(url).expect("Invalid Redis URL");
            
            // Retry logic for Redis connection
            let mut attempts = 0;
            let max_attempts = 10;
            
            loop {
                attempts += 1;
                match ConnectionManager::new(client.clone()).await {
                    Ok(manager) => return Arc::new(manager),
                    Err(e) => {
                        if attempts >= max_attempts {
                            panic!("Failed to connect to Redis after {} attempts: {}", max_attempts, e);
                        }
                        println!("⏳ Redis ConnectionManager attempt {}/{} failed: {}. Retrying in 2s...", attempts, max_attempts, e);
                        sleep(Duration::from_secs(2)).await;
                    }
                }
            }
        })
        .await
        .clone()
}
