use axum::http::{Method, StatusCode};
use axum::{
    middleware,
    routing::{get, post, put},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use dotenv::dotenv;
use std::{env, fs, sync::Arc};
use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod controllers;
mod models;
mod middlewares;

/// Example on how to return status codes and data from an Axum function
async fn health_check() -> (StatusCode, String) {
    let health = true;
    match health {
        true => (StatusCode::OK, "Healthy!".to_string()),
        false => (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Not healthy!".to_string(),
        ), 
    }
}

#[tokio::main]
async fn main() {
    // Initialize tracing for logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "server=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Start crypto runtime, required to connect to redis instance
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("install rustls crypto provider");

    dotenv().ok();

    // Get port from environment variable (Railway sets PORT automatically)
    let port: u16 = env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse()
        .expect("PORT must be a valid number");

    let project_id = env::var("FIREBASE_PROJECT_ID").expect("FIREBASE_PROJECT_ID not set");
    let allowlist = env::var("ADMIN_ALLOWLIST_EMAILS").ok();
    // Prefer inline JSON env, fallback to file path if provided.
    let service_account = env::var("FIREBASE_SERVICE_ACCOUNT_JSON")
        .ok()
        .and_then(|inline| serde_json::from_str::<middlewares::auth::ServiceAccount>(&inline).ok())
        .or_else(|| {
            env::var("FIREBASE_SERVICE_ACCOUNT_PATH")
                .ok()
                .and_then(|path| fs::read_to_string(path).ok())
                .and_then(|contents| serde_json::from_str::<middlewares::auth::ServiceAccount>(&contents).ok())
        });

    let firebase_auth = Arc::new(middlewares::auth::FirebaseAuth::new(
        project_id,
        allowlist,
        service_account,
    ));

    let public_routes = Router::new()
        .route("/", get(health_check))
        .route("/health", get(health_check))

        .route("/rushee/signup", post(controllers::rushee::signup).options(|| async { StatusCode::OK }))
        .route("/rushee/get-rushees", get(controllers::rushee::get_rushees).options(|| async { StatusCode::OK }))
        .route("/rushee/:id", get(controllers::rushee::get_rushee).options(|| async { StatusCode::OK }))
        .route("/rushee/post-comment/:id",post(controllers::rushee::post_comment).options(|| async { StatusCode::OK }))
        .route("/rushee/post-pis/:id", post(controllers::rushee::post_pis).options(|| async { StatusCode::OK }))
        .route("/rushee/autosave-pis/:id", post(controllers::rushee::autosave_pis).options(|| async { StatusCode::OK }))
        .route("/rushee/update-attendance/:id",post(controllers::rushee::update_attendance).options(|| async { StatusCode::OK }))
        .route("/rushee/update-cloud/:id", post(controllers::rushee::update_cloud).options(|| async { StatusCode::OK }))
        .route("/rushee/update-rushee/:id", post(controllers::rushee::update_rushee).options(|| async { StatusCode::OK }))
        .route("/rushee/reschedule-pis/:id", post(controllers::rushee::reschedule_pis).options(|| async { StatusCode::OK }))
        .route("/rushee/edit-comment/:id", post(controllers::rushee::edit_comment).options(|| async { StatusCode::OK }))
        .route("/rushee/delete-comment/:id", post(controllers::rushee::delete_comment).options(|| async { StatusCode::OK }))
        .route("/rushee/does-rushee-exist/:id", get(controllers::rushee::does_rushee_exist))
        .route("/rushee/get-timeslots", get(controllers::rushee::get_signup_timeslots))
        .route("/rushee/get-available-timeslots", get(controllers::rushee::get_available_timeslots))
        .route("/brother/comments/:brother_name", get(controllers::rushee::get_brother_comments).options(|| async { StatusCode::OK }))

        .route("/rushee/vote", post(controllers::voting::handle_rushee_vote).options(|| async { StatusCode::OK }))

        // Public read-only access for rushee registration (timeslots selection)
        .route("/admin/get_pis_timeslots", get(controllers::admin::get_pis_timeslots).options(|| async { StatusCode::OK }))
        .route("/admin/get_pis_questions", get(controllers::admin::get_pis_questions).options(|| async { StatusCode::OK }))
        
        // Public read-only sorting view for all brothers
        .route("/brother/sorting", get(controllers::admin::get_sorting_rushees_public).options(|| async { StatusCode::OK }))
        .route("/brother/rushees/:id/notes", get(controllers::admin::get_rushee_notes).options(|| async { StatusCode::OK }))
        
        // PIS Availability - brother-facing routes (need to be accessible by logged-in brothers)
        .route("/brother/pis-availability/check", post(controllers::admin::check_brother_needs_availability_form).options(|| async { StatusCode::OK }))
        .route("/brother/pis-availability/submit", post(controllers::admin::submit_brother_availability).options(|| async { StatusCode::OK }))
        .route("/admin/pis-availability/status", get(controllers::admin::get_pis_availability_form_status).options(|| async { StatusCode::OK }))
        
        // Rush App access check - public route for login flow
        .route("/brother/rush-app/check-access", post(controllers::admin::check_rush_app_access).options(|| async { StatusCode::OK }))
        // Comment visibility check - public route for rushee page
        .route("/brother/comment-visibility/status", get(controllers::admin::get_comment_visibility_status).options(|| async { StatusCode::OK }));

    // Routes accessible by both admin and bid committee
    let bidcom_routes = Router::new()
        .route("/bidcom/rushees/sorting", get(controllers::admin::get_sorting_rushees).options(|| async { StatusCode::OK }))
        .route("/bidcom/rushees/:id/notes", get(controllers::admin::get_rushee_notes).put(controllers::admin::update_rushee_notes).options(|| async { StatusCode::OK }))
        .route_layer(middleware::from_fn_with_state(
            firebase_auth.clone(),
            middlewares::auth::require_bidcom_or_admin,
        ))
        .with_state(firebase_auth.clone());

    // Admin-only routes
    let admin_routes = Router::new()
        .route("/admin/add_pis_question", post(controllers::admin::add_pis_question).options(|| async { StatusCode::OK }))
        .route("/admin/delete_pis_question", post(controllers::admin::delete_pis_question).options(|| async { StatusCode::OK }))
        // get_pis_questions is in public_routes for rushee registration
        .route("/admin/add_pis_timeslot", post(controllers::admin::add_pis_timeslot).options(|| async { StatusCode::OK }))
        .route("/admin/delete_pis_timeslot", post(controllers::admin::delete_pis_timeslot).options(|| async { StatusCode::OK }))
        // get_pis_timeslots is in public_routes for rushee registration
        .route("/admin/add-rush-night", post(controllers::admin::add_rush_night).options(|| async { StatusCode::OK }))
        .route("/admin/delete_rush_night", post(controllers::admin::delete_rush_night).options(|| async { StatusCode::OK }))
        .route("/admin/pis-signup/:id", post(controllers::admin::brother_pis_sign_up).options(|| async { StatusCode::OK }))
        .route("/admin/get-brother-pis", post(controllers::admin::get_brother_pis).options(|| async { StatusCode::OK }))
        .route("/admin/export-rushee-numbers", get(controllers::admin::export_rushee_numbers).options(|| async { StatusCode::OK }))
        .route("/admin/export-rushee-info", get(controllers::admin::export_rushee_personal_info).options(|| async { StatusCode::OK }))
        .route("/admin/rushees/sorting", get(controllers::admin::get_sorting_rushees).options(|| async { StatusCode::OK }))
        .route("/admin/rushees/:id/notes", get(controllers::admin::get_rushee_notes).put(controllers::admin::update_rushee_notes).options(|| async { StatusCode::OK }))
        .route("/admin/rushees/:id/sorting", put(controllers::admin::update_rushee_sorting).options(|| async { StatusCode::OK }))
        .route("/admin/rushees/reorder", put(controllers::admin::bulk_reorder).options(|| async { StatusCode::OK }))
        .route("/admin/rushees/move", put(controllers::admin::move_rushee).options(|| async { StatusCode::OK }))
        .route("/admin/get-admin-status", post(controllers::admin::get_admin_status).options(|| async { StatusCode::OK }))
        .route("/admin/make-admin", post(controllers::admin::make_admin).options(|| async { StatusCode::OK }))
        .route("/admin/make-bidcom", post(controllers::admin::make_bidcom).options(|| async { StatusCode::OK }))
        .route("/admin/voting/change-rushee", post(controllers::voting::change_rushee).options(|| async { StatusCode::OK }))
        .route("/admin/voting/clear-votes", post(controllers::voting::clear_votes).options(|| async { StatusCode::OK }))
        .route("/admin/voting/make-eligible", post(controllers::voting::make_eligible).options(|| async { StatusCode::OK }))
        .route("/admin/voting/make-ineligible", post(controllers::voting::make_ineligible).options(|| async { StatusCode::OK }))
        .route("/admin/voting/get-eligibility", get(controllers::voting::get_elibibility).options(|| async { StatusCode::OK }))
        .route("/admin/voting/post-question", post(controllers::voting::post_question).options(|| async { StatusCode::OK }))
        .route("/admin/voting/get-rushee", get(controllers::voting::get_rushee).options(|| async { StatusCode::OK }))
        // PIS Availability admin routes
        .route("/admin/pis-availability/send-form", post(controllers::admin::send_pis_availability_form).options(|| async { StatusCode::OK }))
        .route("/admin/pis-availability/clear-and-resend", post(controllers::admin::clear_and_resend_pis_availability_form).options(|| async { StatusCode::OK }))
        .route("/admin/pis-availability/deactivate", post(controllers::admin::deactivate_pis_availability_form).options(|| async { StatusCode::OK }))
        .route("/admin/pis-availability/all", get(controllers::admin::get_all_brother_availabilities).options(|| async { StatusCode::OK }))
        .route("/admin/pis-availability/auto-assign", post(controllers::admin::auto_assign_pis_brothers).options(|| async { StatusCode::OK }))
        .route("/admin/pis-availability/clear-assignments", post(controllers::admin::clear_pis_assignments).options(|| async { StatusCode::OK }))
        .route("/admin/pis-availability/export-csv", get(controllers::admin::export_pis_with_brothers).options(|| async { StatusCode::OK }))
        // Rush App access control routes
        .route("/admin/rush-app/update", post(controllers::admin::update_rush_app_settings).options(|| async { StatusCode::OK }))
        .route("/admin/rush-app/status", get(controllers::admin::get_rush_app_status).options(|| async { StatusCode::OK }))
        // Comment visibility settings routes
        .route("/admin/comment-visibility/update", post(controllers::admin::update_comment_visibility_settings).options(|| async { StatusCode::OK }))
        .route("/admin/comment-visibility/status", get(controllers::admin::get_comment_visibility_settings).options(|| async { StatusCode::OK }))
        .route_layer(middleware::from_fn_with_state(
            firebase_auth.clone(),
            middlewares::auth::require_admin,
        ))
        .with_state(firebase_auth.clone());

    let app = public_routes
        .merge(bidcom_routes)
        .merge(admin_routes)
        // API key middleware - validates X-API-Key header on all requests
        // Applied before CORS so that CORS preflight (OPTIONS) requests still work
        .layer(middleware::from_fn(middlewares::api_key::require_api_key))
        .layer(
            CorsLayer::new()
                .allow_origin(Any) // Allow requests from any origin
                .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS]) // Allow specific HTTP methods
                .allow_headers(Any) // Allow any headers, including custom ones like `Authorization`
                .expose_headers(Any), // Expose specific headers in the browser (optional)
        );

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("🚀 Server starting on http://{}", addr);
    
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .expect("Failed to start server");
} 



