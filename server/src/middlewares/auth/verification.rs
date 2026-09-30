use super::{AuthError, FirebaseAuth, FirebaseClaims, FirebaseUser};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};

impl FirebaseAuth {
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

        let token_data = decode::<FirebaseClaims>(id_token, &decoding_key, &validation)
            .map_err(|_| AuthError::InvalidToken)?;

        let claims = token_data.claims;
        let is_admin = claims
            .custom
            .get("admin")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let is_bidcom = claims
            .custom
            .get("bidcom")
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
            is_admin: is_admin || allowlist_ok,
            is_bidcom,
        })
    }

    pub async fn verify_token_any_brother(
        &self,
        id_token: &str,
    ) -> Result<FirebaseUser, AuthError> {
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

        let token_data = decode::<FirebaseClaims>(id_token, &decoding_key, &validation)
            .map_err(|_| AuthError::InvalidToken)?;

        let claims = token_data.claims;
        let is_admin = claims
            .custom
            .get("admin")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let is_bidcom = claims
            .custom
            .get("bidcom")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let email = claims.email.clone();
        let allowlist_ok = email
            .as_ref()
            .map(|e| self.allowlist.contains(&e.to_ascii_lowercase()))
            .unwrap_or(false);

        // No role check here -- any valid, unexpired token for this Firebase
        // project is accepted. Since only brothers have accounts in this
        // project (rushees never sign in), a valid token means a brother.
        Ok(FirebaseUser {
            uid: claims.sub,
            email,
            is_admin: is_admin || allowlist_ok,
            is_bidcom,
        })
    }

    pub async fn verify_token_bidcom(&self, id_token: &str) -> Result<FirebaseUser, AuthError> {
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

        let token_data = decode::<FirebaseClaims>(id_token, &decoding_key, &validation)
            .map_err(|_| AuthError::InvalidToken)?;

        let claims = token_data.claims;
        let is_admin = claims
            .custom
            .get("admin")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let is_bidcom = claims
            .custom
            .get("bidcom")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let email = claims.email.clone();
        let allowlist_ok = email
            .as_ref()
            .map(|e| self.allowlist.contains(&e.to_ascii_lowercase()))
            .unwrap_or(false);

        // Allow access if admin, bidcom, or on allowlist
        if !(is_admin || is_bidcom || allowlist_ok) {
            return Err(AuthError::NotAdmin);
        }

        Ok(FirebaseUser {
            uid: claims.sub,
            email,
            is_admin: is_admin || allowlist_ok,
            is_bidcom,
        })
    }
}
