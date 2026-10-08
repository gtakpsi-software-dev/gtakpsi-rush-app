use crate::controllers;
use crate::middlewares::{self, auth::FirebaseAuth};
use axum::middleware;
use axum::{
    http::StatusCode,
    routing::{get, post, put},
    Router,
};
use std::sync::Arc;

mod pis_availability;
mod voting;

// Build administrator routes and apply their shared Firebase role gate.
pub(super) fn routes(firebase_auth: Arc<FirebaseAuth>) -> Router {
    let routes = Router::new()
        .route(
            "/admin/season/reset",
            post(controllers::admin::reset_season).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/add_pis_question",
            post(controllers::admin::add_pis_question).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/delete_pis_question",
            post(controllers::admin::delete_pis_question).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/update_pis_question_category",
            post(controllers::admin::update_pis_question_category)
                .options(|| async { StatusCode::OK }),
        )
        // get_pis_questions is in public_routes for rushee registration
        .route(
            "/admin/add_pis_timeslot",
            post(controllers::admin::add_pis_timeslot).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/delete_pis_timeslot",
            post(controllers::admin::delete_pis_timeslot).options(|| async { StatusCode::OK }),
        )
        // get_pis_timeslots is in public_routes for rushee registration
        .route(
            "/admin/add-rush-night",
            post(controllers::admin::add_rush_night).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/delete_rush_night",
            post(controllers::admin::delete_rush_night).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/pis-signup/:id",
            post(controllers::admin::brother_pis_sign_up).options(|| async { StatusCode::OK }),
        )
        // get-brother-pis moved to brother_routes (any signed-in brother, not admin-only)
        .route(
            "/admin/export-rushee-numbers",
            get(controllers::admin::export_rushee_numbers).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/export-rushee-info",
            get(controllers::admin::export_rushee_personal_info)
                .options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/rushees/sorting",
            get(controllers::admin::get_sorting_rushees).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/rushees/:id/notes",
            get(controllers::admin::get_rushee_notes)
                .put(controllers::admin::update_rushee_notes)
                .options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/rushees/:id/sorting",
            put(controllers::admin::update_rushee_sorting).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/rushees/reorder",
            put(controllers::admin::bulk_reorder).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/rushees/move",
            put(controllers::admin::move_rushee).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/get-admin-status",
            post(controllers::admin::get_admin_status).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/make-admin",
            post(controllers::admin::make_admin).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/make-bidcom",
            post(controllers::admin::make_bidcom).options(|| async { StatusCode::OK }),
        );

    // INVARIANT: all admin domains receive the same auth layer below.
    pis_availability::routes(voting::routes(routes))
        // Rush App access control routes
        .route(
            "/admin/rush-app/update",
            post(controllers::admin::update_rush_app_settings).options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/rush-app/status",
            get(controllers::admin::get_rush_app_status).options(|| async { StatusCode::OK }),
        )
        // Comment visibility settings routes
        .route(
            "/admin/comment-visibility/update",
            post(controllers::admin::update_comment_visibility_settings)
                .options(|| async { StatusCode::OK }),
        )
        .route(
            "/admin/comment-visibility/status",
            get(controllers::admin::get_comment_visibility_settings)
                .options(|| async { StatusCode::OK }),
        )
        .route_layer(middleware::from_fn_with_state(
            firebase_auth.clone(),
            middlewares::auth::require_admin,
        ))
        .with_state(firebase_auth.clone())
}
