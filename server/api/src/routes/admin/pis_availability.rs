use crate::controllers;
use crate::middlewares::auth::FirebaseAuth;
use axum::{
    http::StatusCode,
    routing::{get, post},
    Router,
};
use std::sync::Arc;

pub(super) fn routes(router: Router<Arc<FirebaseAuth>>) -> Router<Arc<FirebaseAuth>> {
    router
        .route(
            "/admin/pis-availability/send-form",
            post(controllers::admin::send_pis_availability_form)
                .options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/pis-availability/clear-and-resend",
            post(controllers::admin::clear_and_resend_pis_availability_form)
                .options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/pis-availability/deactivate",
            post(controllers::admin::deactivate_pis_availability_form)
                .options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/pis-availability/all",
            get(controllers::admin::get_all_brother_availabilities)
                .options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/pis-availability/auto-assign",
            post(controllers::admin::auto_assign_pis_brothers).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/pis-availability/clear-assignments",
            post(controllers::admin::clear_pis_assignments).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/pis-availability/export-csv",
            get(controllers::admin::export_pis_with_brothers).options(|| async { StatusCode::OK }),
        )
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Method, Request},
    };
    use tower::ServiceExt;

    #[tokio::test]
    async fn route_group_keeps_methods_and_options_without_invoking_handlers() {
        let router: Router = routes(Router::<Arc<FirebaseAuth>>::new()).with_state(Arc::new(
            FirebaseAuth::new("local-test-project".to_string(), None, None),
        ));

        for (method, path) in [
            (Method::POST, "/admin/pis-availability/send-form"),
            (Method::POST, "/admin/pis-availability/clear-and-resend"),
            (Method::POST, "/admin/pis-availability/deactivate"),
            (Method::GET, "/admin/pis-availability/all"),
            (Method::POST, "/admin/pis-availability/auto-assign"),
            (Method::POST, "/admin/pis-availability/clear-assignments"),
            (Method::GET, "/admin/pis-availability/export-csv"),
        ] {
            let wrong_method = if method == Method::GET {
                Method::POST
            } else {
                Method::GET
            };
            let wrong = Request::builder()
                .method(wrong_method)
                .uri(path)
                .body(Body::empty())
                .unwrap();
            let response = router.clone().oneshot(wrong).await.unwrap();
            assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED, "{path}");

            let preflight = Request::builder()
                .method(Method::OPTIONS)
                .uri(path)
                .body(Body::empty())
                .unwrap();
            let response = router.clone().oneshot(preflight).await.unwrap();
            assert_eq!(response.status(), StatusCode::OK, "{path}");
        }
    }
}
