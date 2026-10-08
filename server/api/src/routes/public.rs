use super::health_check;
use crate::controllers;
use axum::{
    http::StatusCode,
    routing::{get, post},
    Router,
};

mod rushee;

// Build routes without a Firebase role gate, including health and registration endpoints.
pub(super) fn routes() -> Router {
    let routes = Router::new()
        .route("/", get(health_check))
        .route("/health", get(health_check));

    rushee::routes(routes)
        .route(
            "/brother/comments/:brother_name",
            get(controllers::rushee::get_brother_comments).options(|| async { StatusCode::OK }),
        )
        .route(
            "/rushee/vote",
            post(controllers::voting::handle_rushee_vote).options(|| async { StatusCode::OK }),
        )
        // Public read-only access for rushee registration (timeslots selection)
        .route(
            "/admin/get_pis_timeslots",
            get(controllers::admin::get_pis_timeslots).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/get_pis_questions",
            get(controllers::admin::get_pis_questions).options(|| async { StatusCode::OK }),
        )
        // Public read-only sorting view for all brothers
        .route(
            "/brother/sorting",
            get(controllers::admin::get_sorting_rushees_public)
                .options(|| async { StatusCode::OK }),
        )
        .route(
            "/brother/rushees/:id/notes",
            get(controllers::admin::get_rushee_notes).options(|| async { StatusCode::OK }),
        )
        // PIS Availability - brother-facing routes (need to be accessible by logged-in brothers)
        .route(
            "/brother/pis-availability/check",
            post(controllers::admin::check_brother_needs_availability_form)
                .options(|| async { StatusCode::OK }),
        )
        .route(
            "/brother/pis-availability/submit",
            post(controllers::admin::submit_brother_availability)
                .options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/pis-availability/status",
            get(controllers::admin::get_pis_availability_form_status)
                .options(|| async { StatusCode::OK }),
        )
        // Rush App access check - public route for login flow
        .route(
            "/brother/rush-app/check-access",
            post(controllers::admin::check_rush_app_access).options(|| async { StatusCode::OK }),
        )
        // Midterm mode status - public route for all clients
        .route(
            "/brother/rush-app/midterm-status",
            get(controllers::admin::get_midterm_mode_status).options(|| async { StatusCode::OK }),
        )
        // Comment visibility check - public route for rushee page
        .route(
            "/brother/comment-visibility/status",
            get(controllers::admin::get_comment_visibility_status)
                .options(|| async { StatusCode::OK }),
        )
}
