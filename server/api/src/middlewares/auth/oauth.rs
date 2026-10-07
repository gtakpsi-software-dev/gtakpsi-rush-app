use super::{AuthError, FirebaseAuth, ServiceAccount};
use jsonwebtoken::Algorithm;
use serde::Deserialize;

impl FirebaseAuth {
    pub(super) async fn fetch_access_token(
        &self,
        sa: &ServiceAccount,
    ) -> Result<String, AuthError> {
        // Google OAuth exchanges a signed service-account JWT for a short-lived access token.
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

        // Service-account keys stay server-side; only the signed assertion is sent to Google.
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
