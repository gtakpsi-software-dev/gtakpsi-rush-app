use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;
use std::{collections::HashMap, sync::Arc, time::Instant};
use tokio::sync::RwLock;

mod certificates;
mod middleware;
mod oauth;
mod roles;
mod verification;

#[cfg(test)]
mod tests;

pub use middleware::{require_admin, require_any_brother, require_bidcom_or_admin, AdminUser};

#[derive(Debug, Clone)]
pub struct FirebaseAuth {
    project_id: String,
    allowlist: Vec<String>,
    client: Client,
    cert_cache: Arc<RwLock<CertCache>>,
    service_account: Option<ServiceAccount>,
}

#[derive(Debug, Clone)]
struct CertCache {
    fetched_at: Instant,
    certs: HashMap<String, String>, // kid -> PEM cert
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServiceAccount {
    client_email: String,
    private_key: String,
    token_uri: String,
    #[serde(default)]
    project_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FirebaseClaims {
    aud: String,
    iss: String,
    sub: String,
    exp: usize,
    iat: usize,
    email: Option<String>,
    #[serde(flatten)]
    custom: HashMap<String, Value>,
}

#[derive(Debug, Clone)]
pub struct FirebaseUser {
    pub uid: String,
    pub email: Option<String>,
    pub is_admin: bool,
    pub is_bidcom: bool,
}

#[derive(Debug)]
pub enum AuthError {
    InvalidToken,
    NotAdmin,
    ServiceAccountMissing,
    Internal,
}

impl FirebaseAuth {
    pub fn new(
        project_id: String,
        allowlist_csv: Option<String>,
        service_account: Option<ServiceAccount>,
    ) -> Self {
        let allowlist = allowlist_csv
            .unwrap_or_default()
            .split(',')
            .filter_map(|s| {
                let trimmed = s.trim();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_ascii_lowercase())
                }
            })
            .collect::<Vec<_>>();

        FirebaseAuth {
            project_id,
            allowlist,
            client: Client::new(),
            cert_cache: Arc::new(RwLock::new(CertCache {
                fetched_at: Instant::now(),
                certs: HashMap::new(),
            })),
            service_account,
        }
    }

    pub fn is_allowlisted(&self, email: &str) -> bool {
        self.allowlist.iter().any(|e| e.eq_ignore_ascii_case(email))
    }

    pub fn has_service_account(&self) -> bool {
        self.service_account.is_some()
    }
}
