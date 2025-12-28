use std::{collections::HashMap, sync::Arc, time::Instant};

use async_trait::async_trait;
use axum::{
    extract::{FromRef, FromRequestParts, State},
    http::{request::Parts, HeaderMap, StatusCode},
    middleware::Next,
};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use once_cell::sync::Lazy;
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;
use tokio::sync::RwLock;

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
}

#[derive(Debug)]
pub enum AuthError {
    MissingAuthHeader,
    InvalidToken,
    NotAdmin,
    ServiceAccountMissing,
    Internal,
}

static CERT_URL: &str =
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

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

    pub async fn verify_token(&self, id_token: &str) -> Result<FirebaseUser, AuthError> {
        let header = decode_header(id_token).map_err(|_| AuthError::InvalidToken)?;
        let kid = header.kid.ok_or(AuthError::InvalidToken)?;

        let certs = self.fetch_certs().await.map_err(|_| AuthError::Internal)?;
        let cert_pem = certs.get(&kid).ok_or(AuthError::InvalidToken)?;

        let decoding_key =
            DecodingKey::from_rsa_pem(cert_pem.as_bytes()).map_err(|_| AuthError::InvalidToken)?;

        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_audience(&[self.project_id.clone()]);
        validation.set_issuer(&[format!(
            "https://securetoken.google.com/{}",
            self.project_id
        )]);
        validation.validate_exp = true;
        validation.required_spec_claims.insert("sub".to_string());

        let token_data =
            decode::<FirebaseClaims>(id_token, &decoding_key, &validation).map_err(|_| {
                AuthError::InvalidToken
            })?;

        let claims = token_data.claims;
        let is_admin = claims
            .custom
            .get("admin")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let email = claims.email.clone();
        let allowlist_ok = email
            .as_ref()
            .map(|e| self.allowlist.contains(&e.to_ascii_lowercase()))
            .unwrap_or(false);

        if !(is_admin || allowlist_ok) {
            return Err(AuthError::NotAdmin);
        }

        Ok(FirebaseUser {
            uid: claims.sub,
            email,
            is_admin: true,
        })
    }

    async fn fetch_certs(&self) -> Result<HashMap<String, String>, reqwest::Error> {
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

    pub fn is_allowlisted(&self, email: &str) -> bool {
        self.allowlist
            .iter()
            .any(|e| e.eq_ignore_ascii_case(email))
    }

    pub fn has_service_account(&self) -> bool {
        self.service_account.is_some()
    }

    pub async fn set_admin_claim(&self, uid: &str, make_admin: bool) -> Result<(), AuthError> {
        let sa = self
            .service_account
            .as_ref()
            .ok_or(AuthError::ServiceAccountMissing)?;

        let access_token = self
            .fetch_access_token(sa)
            .await
            .map_err(|_| AuthError::Internal)?;

        let url = format!(
            "https://identitytoolkit.googleapis.com/v1/projects/{}/accounts:update",
            sa.project_id
                .clone()
                .unwrap_or_else(|| self.project_id.clone())
        );

        #[derive(serde::Serialize)]
        struct UpdateBody<'a> {
            localId: &'a str,
            customAttributes: String,
        }

        let body = UpdateBody {
            localId: uid,
            customAttributes: serde_json::json!({ "admin": make_admin }).to_string(),
        };

        let resp = self
            .client
            .post(url)
            .bearer_auth(access_token)
            .json(&body)
            .send()
            .await
            .map_err(|_| AuthError::Internal)?;

        if resp.status().is_success() {
            Ok(())
        } else {
            Err(AuthError::Internal)
        }
    }

    async fn fetch_access_token(&self, sa: &ServiceAccount) -> Result<String, AuthError> {
        // JWT for OAuth2 client_credentials
        #[derive(serde::Serialize)]
        struct Claims<'a> {
            iss: &'a str,
            scope: &'a str,
            aud: &'a str,
            exp: usize,
            iat: usize,
        }

        let now = chrono::Utc::now().timestamp() as usize;
        let claims = Claims {
            iss: &sa.client_email,
            scope: "https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/firebase",
            aud: &sa.token_uri,
            exp: now + 3600,
            iat: now,
        };

        let header = jsonwebtoken::Header::new(Algorithm::RS256);
        let private_key = jsonwebtoken::EncodingKey::from_rsa_pem(sa.private_key.as_bytes())
            .map_err(|_| AuthError::Internal)?;

        let jwt = jsonwebtoken::encode(&header, &claims, &private_key)
            .map_err(|_| AuthError::Internal)?;

        #[derive(serde::Serialize)]
        struct TokenRequest<'a> {
            grant_type: &'a str,
            assertion: &'a str,
        }

        #[derive(Deserialize)]
        struct TokenResponse {
            access_token: String,
        }

        let resp = self
            .client
            .post(&sa.token_uri)
            .form(&TokenRequest {
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion: &jwt,
            })
            .send()
            .await
            .map_err(|_| AuthError::Internal)?;

        let data: TokenResponse = resp.json().await.map_err(|_| AuthError::Internal)?;
        Ok(data.access_token)
    }
}

// Extractor to pull the verified admin user from requests
pub struct AdminUser(pub FirebaseUser);

#[async_trait]
impl<S> FromRequestParts<S> for AdminUser
where
    Arc<FirebaseAuth>: axum::extract::FromRef<S>,
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let auth = Arc::<FirebaseAuth>::from_ref(state);
        let headers = parts.headers.clone();
        let token = extract_bearer(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
        let user = auth.verify_token(&token).await.map_err(|_| StatusCode::FORBIDDEN)?;
        Ok(AdminUser(user))
    }
}

fn extract_bearer(headers: &HeaderMap) -> Option<String> {
    let value = headers.get(axum::http::header::AUTHORIZATION)?;
    let value = value.to_str().ok()?;
    if let Some(rest) = value.strip_prefix("Bearer ") {
        Some(rest.to_string())
    } else if let Some(rest) = value.strip_prefix("bearer ") {
        Some(rest.to_string())
    } else {
        None
    }
}

pub async fn require_admin<B>(
    State(auth): State<Arc<FirebaseAuth>>,
    mut req: axum::http::Request<B>,
    next: Next<B>,
) -> Result<axum::response::Response, StatusCode>
where
    B: Send + 'static,
{
    let token = req
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|s| {
            if let Some(rest) = s.strip_prefix("Bearer ") {
                Some(rest.to_string())
            } else if let Some(rest) = s.strip_prefix("bearer ") {
                Some(rest.to_string())
            } else {
                None
            }
        })
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let user = auth.verify_token(&token).await.map_err(|err| match err {
        AuthError::NotAdmin => StatusCode::FORBIDDEN,
        _ => StatusCode::UNAUTHORIZED,
    })?;

    req.extensions_mut().insert(user);
    Ok(next.run(req).await)
}

