use crate::controllers;
use axum::{
    http::StatusCode,
    routing::{get, post},
    Router,
};

// Add rushee registration, profile, attendance, comment, and PIS endpoints.
pub(super) fn routes(router: Router) -> Router {
    router
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
}
