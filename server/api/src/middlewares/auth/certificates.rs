use super::FirebaseAuth;
use std::{collections::HashMap, time::Instant};

const CERT_URL: &str =
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

impl FirebaseAuth {
    // Return cached Firebase signing certificates, refreshing an empty cache or one older than 50 minutes.
    pub(super) async fn fetch_certs(&self) -> Result<HashMap<String, String>, reqwest::Error> {
        let mut guard = self.cert_cache.write().await;
        // Refresh if older than 50 minutes
        if guard.certs.is_empty() || guard.fetched_at.elapsed().as_secs() > 3000 {
            let resp = self.client.get(CERT_URL).send().await?;
            let map: HashMap<String, String> = resp.json().await?;
            guard.certs = map.clone();
            guard.fetched_at = Instant::now();
            Ok(map)
        } else {
            Ok(guard.certs.clone())
        }
    }
}
