use super::{AuthError, FirebaseAuth};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde_json::{json, Value};

mod http;
mod verification;

const PROJECT: &str = "rush-auth-test-project";
const KEY_ID: &str = "local-test-key";

async fn auth(allowlist: Option<&str>) -> FirebaseAuth {
    let auth = FirebaseAuth::new(PROJECT.to_string(), allowlist.map(str::to_string), None);
    // A populated fresh cache keeps verification offline and independent of Google certificates.
    auth.cert_cache.write().await.certs.insert(
        KEY_ID.to_string(),
        include_str!("fixtures/test-only-public.pem").to_string(),
    );
    auth
}

fn claims() -> Value {
    let now = chrono::Utc::now().timestamp();
    json!({
        "aud": PROJECT,
        "iss": format!("https://securetoken.google.com/{PROJECT}"),
        "sub": "test-brother-uid",
        "iat": now,
        "exp": now + 3600,
        "email": "brother@example.test"
    })
}

fn token(claims: &Value) -> String {
    signed_token(claims, Some(KEY_ID), Algorithm::RS256)
}

fn signed_token(claims: &Value, kid: Option<&str>, algorithm: Algorithm) -> String {
    let mut header = Header::new(algorithm);
    header.kid = kid.map(str::to_string);
    let key = EncodingKey::from_rsa_pem(include_bytes!("fixtures/test-only-private.pem")).unwrap();
    encode(&header, claims, &key).unwrap()
}
