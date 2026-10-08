use crate::controllers;
use crate::middlewares::auth::FirebaseAuth;
use axum::{
    http::StatusCode,
    routing::{get, post},
    Router,
};
use std::sync::Arc;

// Add voting administration endpoints to the supplied administrator router.
pub(super) fn routes(router: Router<Arc<FirebaseAuth>>) -> Router<Arc<FirebaseAuth>> {
    router
        .route(
            "/admin/voting/change-rushee",
            post(controllers::voting::change_rushee).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/voting/clear-votes",
            post(controllers::voting::clear_votes).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/voting/make-eligible",
            post(controllers::voting::make_eligible).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/voting/make-ineligible",
            post(controllers::voting::make_ineligible).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/voting/get-eligibility",
            get(controllers::voting::get_eligibility).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/voting/post-question",
            post(controllers::voting::post_question).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/voting/get-rushee",
            get(controllers::voting::get_rushee).options(|| async { StatusCode::OK }),
        )
}
