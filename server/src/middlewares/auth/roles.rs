use super::{AuthError, FirebaseAuth};
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;

// Firebase requires these camelCase JSON keys even though Rust uses snake_case fields.
#[derive(serde::Serialize)]
struct LookupBody<'a> {
    #[serde(rename = "localId")]
    local_id: Vec<&'a str>,
}

#[derive(Deserialize)]
struct LookupResponse {
    users: Option<Vec<UserRecord>>,
}

#[derive(Deserialize)]
struct UserRecord {
    #[serde(default, rename = "customAttributes")]
    custom_attributes: Option<String>,
}

#[derive(serde::Serialize)]
struct UpdateBody<'a> {
    #[serde(rename = "localId")]
    local_id: &'a str,
    #[serde(rename = "customAttributes")]
    custom_attributes: String,
}

impl FirebaseAuth {
    async fn get_custom_claims(&self, uid: &str) -> Result<HashMap<String, Value>, AuthError> {
        let sa = self
            .service_account
            .as_ref()
            .ok_or(AuthError::ServiceAccountMissing)?;

        let access_token = self
            .fetch_access_token(sa)
            .await
            .map_err(|_| AuthError::Internal)?;

        let url = format!(
            "https://identitytoolkit.googleapis.com/v1/projects/{}/accounts:lookup",
            sa.project_id
                .clone()
                .unwrap_or_else(|| self.project_id.clone())
        );

        let resp = self
            .client
            .post(url)
            .bearer_auth(access_token)
            .json(&LookupBody {
                local_id: vec![uid],
            })
            .send()
            .await
            .map_err(|_| AuthError::Internal)?;

        if !resp.status().is_success() {
            return Err(AuthError::Internal);
        }

        let data: LookupResponse = resp.json().await.map_err(|_| AuthError::Internal)?;
        let attrs = data
            .users
            .and_then(|mut users| users.pop())
            .and_then(|u| u.custom_attributes);

        if let Some(json_str) = attrs {
            if let Ok(map) = serde_json::from_str::<HashMap<String, Value>>(&json_str) {
                return Ok(map);
            }
        }

        Ok(HashMap::new())
    }

    async fn update_custom_claim(
        &self,
        uid: &str,
        claim_name: &str,
        claim_value: bool,
    ) -> Result<(), AuthError> {
        let sa = self
            .service_account
            .as_ref()
            .ok_or(AuthError::ServiceAccountMissing)?;

        // Preserve unrelated claims on role changes; retain the existing empty-map fallback on lookup failure.
        let mut claims = self.get_custom_claims(uid).await.unwrap_or_default();

        claims.insert(claim_name.to_string(), Value::Bool(claim_value));

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

        let body = UpdateBody {
            local_id: uid,
            custom_attributes: serde_json::to_string(&claims).map_err(|_| AuthError::Internal)?,
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

    pub async fn set_admin_claim(&self, uid: &str, make_admin: bool) -> Result<(), AuthError> {
        self.update_custom_claim(uid, "admin", make_admin).await
    }

    pub async fn set_bidcom_claim(&self, uid: &str, make_bidcom: bool) -> Result<(), AuthError> {
        self.update_custom_claim(uid, "bidcom", make_bidcom).await
    }

    pub async fn get_admin_status(&self, uid: &str) -> Result<bool, AuthError> {
        let claims = self.get_custom_claims(uid).await?;
        Ok(claims
            .get("admin")
            .and_then(|v| v.as_bool())
            .unwrap_or(false))
    }

    pub async fn get_bidcom_status(&self, uid: &str) -> Result<bool, AuthError> {
        let claims = self.get_custom_claims(uid).await?;
        Ok(claims
            .get("bidcom")
            .and_then(|v| v.as_bool())
            .unwrap_or(false))
    }

    pub async fn get_user_roles(&self, uid: &str) -> Result<(bool, bool), AuthError> {
        let claims = self.get_custom_claims(uid).await?;
        let is_admin = claims
            .get("admin")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let is_bidcom = claims
            .get("bidcom")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        Ok((is_admin, is_bidcom))
    }
}

#[cfg(test)]
mod tests {
    use super::{LookupBody, LookupResponse, UpdateBody};
    use serde_json::{json, to_value};

    #[test]
    fn firebase_role_wire_fields_keep_camel_case() {
        let lookup = LookupBody {
            local_id: vec!["brother-1"],
        };
        assert_eq!(
            to_value(lookup).unwrap(),
            json!({ "localId": ["brother-1"] })
        );

        let response: LookupResponse = serde_json::from_value(json!({
            "users": [{ "customAttributes": "{\"admin\":true}" }]
        }))
        .unwrap();
        assert_eq!(
            response.users.unwrap().pop().unwrap().custom_attributes,
            Some("{\"admin\":true}".to_string())
        );

        let update = UpdateBody {
            local_id: "brother-1",
            custom_attributes: "{\"admin\":true}".to_string(),
        };
        assert_eq!(
            to_value(update).unwrap(),
            json!({ "localId": "brother-1", "customAttributes": "{\"admin\":true}" })
        );
    }
}
