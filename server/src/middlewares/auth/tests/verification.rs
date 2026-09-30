use super::*;

#[tokio::test]
async fn role_matrix_preserves_brother_bidcom_admin_and_allowlist_access() {
    for admin in [false, true] {
        for bidcom in [false, true] {
            for allowlisted in [false, true] {
                let auth =
                    auth(allowlisted.then_some(" BROTHER@EXAMPLE.TEST, ,other@example.test "))
                        .await;
                let mut claims = claims();
                claims["admin"] = json!(admin);
                claims["bidcom"] = json!(bidcom);
                let token = token(&claims);

                let brother = auth.verify_token_any_brother(&token).await.unwrap();
                assert_eq!(brother.uid, "test-brother-uid");
                assert_eq!(brother.email.as_deref(), Some("brother@example.test"));
                assert_eq!(brother.is_admin, admin || allowlisted);
                assert_eq!(brother.is_bidcom, bidcom);

                let admin_result = auth.verify_token(&token).await;
                assert_eq!(admin_result.is_ok(), admin || allowlisted);
                if let Err(error) = admin_result {
                    assert!(matches!(error, AuthError::NotAdmin));
                }
                let bidcom_result = auth.verify_token_bidcom(&token).await;
                assert_eq!(bidcom_result.is_ok(), admin || bidcom || allowlisted);
                if let Err(error) = bidcom_result {
                    assert!(matches!(error, AuthError::NotAdmin));
                }
            }
        }
    }
}

#[tokio::test]
async fn role_claims_require_booleans_and_email_is_optional() {
    let auth = auth(Some("brother@example.test")).await;
    let mut claims = claims();
    claims.as_object_mut().unwrap().remove("email");
    claims["admin"] = json!("true");
    claims["bidcom"] = json!(1);
    let token = token(&claims);

    let brother = auth.verify_token_any_brother(&token).await.unwrap();
    assert_eq!(brother.email, None);
    assert!(!brother.is_admin);
    assert!(!brother.is_bidcom);
    assert!(matches!(
        auth.verify_token(&token).await,
        Err(AuthError::NotAdmin)
    ));
    assert!(matches!(
        auth.verify_token_bidcom(&token).await,
        Err(AuthError::NotAdmin)
    ));
    assert!(auth.is_allowlisted("BROTHER@EXAMPLE.TEST"));
    assert!(!auth.is_allowlisted(" brother@example.test "));
}

#[tokio::test]
async fn every_verifier_rejects_invalid_identity_claims_and_signature_metadata() {
    let auth = auth(None).await;
    let mut valid = claims();
    valid["admin"] = json!(true);
    let mut invalid_tokens = vec![
        "not-a-jwt".to_string(),
        signed_token(&valid, None, Algorithm::RS256),
        signed_token(&valid, Some("unknown-key"), Algorithm::RS256),
        signed_token(&valid, Some(KEY_ID), Algorithm::RS384),
    ];
    for (field, value) in [
        ("aud", json!("another-project")),
        (
            "iss",
            json!("https://securetoken.google.com/another-project"),
        ),
        ("exp", json!(chrono::Utc::now().timestamp() - 3600)),
    ] {
        let mut invalid = valid.clone();
        invalid[field] = value;
        invalid_tokens.push(token(&invalid));
    }
    for field in ["aud", "iss", "sub", "exp", "iat"] {
        let mut invalid = valid.clone();
        invalid.as_object_mut().unwrap().remove(field);
        invalid_tokens.push(token(&invalid));
    }
    let mut tampered = token(&valid);
    // Changing the first signature character avoids base64 padding-bit ambiguities.
    let signature_start = tampered.rfind('.').unwrap() + 1;
    let replacement = if &tampered[signature_start..signature_start + 1] == "A" {
        "B"
    } else {
        "A"
    };
    tampered.replace_range(signature_start..signature_start + 1, replacement);
    invalid_tokens.push(tampered);

    for token in invalid_tokens {
        assert!(matches!(
            auth.verify_token(&token).await,
            Err(AuthError::InvalidToken)
        ));
        assert!(matches!(
            auth.verify_token_bidcom(&token).await,
            Err(AuthError::InvalidToken)
        ));
        assert!(matches!(
            auth.verify_token_any_brother(&token).await,
            Err(AuthError::InvalidToken)
        ));
    }
}

#[tokio::test]
async fn missing_service_account_fails_before_any_remote_role_operation() {
    let auth = auth(None).await;
    assert!(!auth.has_service_account());
    assert!(matches!(
        auth.set_admin_claim("uid", true).await,
        Err(AuthError::ServiceAccountMissing)
    ));
    assert!(matches!(
        auth.set_bidcom_claim("uid", true).await,
        Err(AuthError::ServiceAccountMissing)
    ));
    assert!(matches!(
        auth.get_user_roles("uid").await,
        Err(AuthError::ServiceAccountMissing)
    ));
}
