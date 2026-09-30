use super::health_check;
use crate::controllers;
use axum::{
    http::StatusCode,
    routing::{get, post},
    Router,
};

pub(super) fn routes() -> Router {
    Router::new()
        .route("/", get(health_check))
        .route("/health", get(health_check))
        .route(
            "/rushee/signup",
            post(controllers::rushee::signup).options(|| async { StatusCode::OK }),
        )
        .route(
            "/rushee/get-rushees",
            get(controllers::rushee::get_rushees).options(|| async { StatusCode::OK }),
        )
        .route(
            "/rushee/rush-nights",
            get(controllers::rushee::get_rush_nights).options(|| async { StatusCode::OK }),
        )
        .route(
            "/rushee/:id",
            get(controllers::rushee::get_rushee).options(|| async { StatusCode::OK }),
        )
        .route(
            "/rushee/self/:id",
            get(controllers::rushee::get_rushee_self).options(|| async { StatusCode::OK }),
        )
        .route(
            "/rushee/get-pis-questions/:id",
            get(controllers::rushee::get_pis_interview_questions)
                .options(|| async { StatusCode::OK }),
        )
        .route(
            "/rushee/post-comment/:id",
            post(controllers::rushee::post_comment).options(|| async { StatusCode::OK }),
        )
        .route(
            "/rushee/post-pis/:id",
            post(controllers::rushee::post_pis).options(|| async { StatusCode::OK }),
        )
        .route(
            "/rushee/autosave-pis/:id",
            post(controllers::rushee::autosave_pis).options(|| async { StatusCode::OK }),
        )
        .route(
            "/rushee/update-attendance/:id",
            post(controllers::rushee::update_attendance).options(|| async { StatusCode::OK }),
        )
        .route(
            "/rushee/update-cloud/:id",
            post(controllers::rushee::update_cloud).options(|| async { StatusCode::OK }),
        )
        .route(
            "/rushee/update-rushee/:id",
            post(controllers::rushee::update_rushee).options(|| async { StatusCode::OK }),
        )
        .route(
            "/rushee/reschedule-pis/:id",
            post(controllers::rushee::reschedule_pis).options(|| async { StatusCode::OK }),
        )
        .route(
            "/rushee/edit-comment/:id",
            post(controllers::rushee::edit_comment).options(|| async { StatusCode::OK }),
        )
        .route(
            "/rushee/delete-comment/:id",
            post(controllers::rushee::delete_comment).options(|| async { StatusCode::OK }),
        )
        .route(
            "/rushee/does-rushee-exist/:id",
            get(controllers::rushee::does_rushee_exist),
        )
        .route(
            "/rushee/get-timeslots",
            get(controllers::rushee::get_signup_timeslots),
        )
        .route(
            "/rushee/get-available-timeslots",
            get(controllers::rushee::get_available_timeslots),
        )
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
