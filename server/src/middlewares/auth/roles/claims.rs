use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;

// Firebase requires these camelCase JSON keys even though Rust uses snake_case fields.
#[derive(serde::Serialize)]
pub(super) struct LookupBody<'a> {
    #[serde(rename = "localId")]
    pub(super) local_id: Vec<&'a str>,
}

#[derive(Deserialize)]
pub(super) struct LookupResponse {
    users: Option<Vec<UserRecord>>,
}

#[derive(Deserialize)]
struct UserRecord {
    #[serde(default, rename = "customAttributes")]
    custom_attributes: Option<String>,
}

#[derive(serde::Serialize)]
pub(super) struct UpdateBody<'a> {
    #[serde(rename = "localId")]
    pub(super) local_id: &'a str,
    #[serde(rename = "customAttributes")]
    pub(super) custom_attributes: String,
}

pub(super) fn claims_from_lookup_response(data: LookupResponse) -> HashMap<String, Value> {
    let attrs = data
        .users
        .and_then(|mut users| users.pop())
        .and_then(|u| u.custom_attributes);

    if let Some(json_str) = attrs {
        if let Ok(map) = serde_json::from_str::<HashMap<String, Value>>(&json_str) {
            return map;
        }
    }

    // INVARIANT: missing or malformed Firebase attributes never grant a role.
    HashMap::new()
}

pub(super) fn role_enabled(claims: &HashMap<String, Value>, role: &str) -> bool {
    claims
        .get(role)
        .and_then(|value| value.as_bool())
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::{
        claims_from_lookup_response, role_enabled, LookupBody, LookupResponse, UpdateBody,
    };
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

    #[test]
    fn firebase_lookup_preserves_last_user_and_malformed_claim_fallback() {
        let response: LookupResponse = serde_json::from_value(json!({
            "users": [
                { "customAttributes": "{\"admin\":true}" },
                { "customAttributes": "{\"bidcom\":true}" }
            ]
        }))
        .unwrap();
        let claims = claims_from_lookup_response(response);
        assert_eq!(claims.get("admin"), None);
        assert_eq!(claims.get("bidcom"), Some(&json!(true)));

        for response in [
            json!({}),
            json!({ "users": [] }),
            json!({ "users": [{}] }),
            json!({ "users": [{ "customAttributes": "invalid" }] }),
            json!({ "users": [
                { "customAttributes": "{\"admin\":true}" },
                { "customAttributes": "invalid" }
            ] }),
        ] {
            let parsed = serde_json::from_value(response).unwrap();
            assert!(claims_from_lookup_response(parsed).is_empty());
        }
    }

    #[test]
    fn role_flags_require_json_booleans() {
        let claims = serde_json::from_value(json!({
            "admin": "true", "bidcom": true, "other": 1
        }))
        .unwrap();
        assert!(!role_enabled(&claims, "admin"));
        assert!(role_enabled(&claims, "bidcom"));
        assert!(!role_enabled(&claims, "other"));
        assert!(!role_enabled(&claims, "missing"));
    }
}
