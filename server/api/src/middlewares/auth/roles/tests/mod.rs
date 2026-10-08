use super::*;

mod remote;

// Verify project selection and URL construction for Firebase account actions.
#[test]
fn identity_toolkit_urls_keep_the_project_and_operation_paths() {
    let mut auth = FirebaseAuth::new("default-project".to_string(), None, None);
    let mut service_account = ServiceAccount {
        client_email: String::new(),
        private_key: String::new(),
        token_uri: String::new(),
        project_id: None,
    };

    assert_eq!(
        auth.identity_toolkit_url(&service_account, "lookup"),
        "https://identitytoolkit.googleapis.com/v1/projects/default-project/accounts:lookup"
    );
    service_account.project_id = Some("service-project".to_string());
    auth.identity_toolkit_base_url = Some("http://127.0.0.1:4000".to_string());
    assert_eq!(
        auth.identity_toolkit_url(&service_account, "update"),
        "http://127.0.0.1:4000/v1/projects/service-project/accounts:update"
    );
}
