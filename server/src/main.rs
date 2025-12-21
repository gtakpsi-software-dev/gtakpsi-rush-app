use axum::http::{Method, StatusCode};
use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use dotenv::dotenv;
use std::env;
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

    let app = Router::new()
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

        .route("/admin/add_pis_question", post(controllers::admin::add_pis_question).options(|| async { StatusCode::OK }))
        .route("/admin/delete_pis_question", post(controllers::admin::delete_pis_question).options(|| async { StatusCode::OK }))
        .route("/admin/get_pis_questions", get(controllers::admin::get_pis_questions).options(|| async { StatusCode::OK }))
        .route("/admin/add_pis_timeslot", post(controllers::admin::add_pis_timeslot).options(|| async { StatusCode::OK }))
        .route("/admin/delete_pis_timeslot", post(controllers::admin::delete_pis_timeslot).options(|| async { StatusCode::OK }))
        .route("/admin/get_pis_timeslots", get(controllers::admin::get_pis_timeslots).options(|| async { StatusCode::OK }))
        .route("/admin/add-rush-night", post(controllers::admin::add_rush_night).options(|| async { StatusCode::OK }))
        .route("/admin/delete_rush_night", post(controllers::admin::delete_rush_night).options(|| async { StatusCode::OK }))
        .route("/admin/pis-signup/:id", post(controllers::admin::brother_pis_sign_up).options(|| async { StatusCode::OK }))
        .route("/admin/get-brother-pis", post(controllers::admin::get_brother_pis).options(|| async { StatusCode::OK }))
        .route("/admin/export-rushee-numbers", get(controllers::admin::export_rushee_numbers).options(|| async { StatusCode::OK }))
        
        .route("/rushee/vote", post(controllers::voting::handle_rushee_vote).options(|| async { StatusCode::OK }))
        .route("/admin/voting/change-rushee", post(controllers::voting::change_rushee).options(|| async { StatusCode::OK }))
        .route("/admin/voting/clear-votes", post(controllers::voting::clear_votes).options(|| async { StatusCode::OK }))
        .route("/admin/voting/make-eligible", post(controllers::voting::make_eligible).options(|| async { StatusCode::OK }))
        .route("/admin/voting/make-ineligible", post(controllers::voting::make_ineligible).options(|| async { StatusCode::OK }))
        .route("/admin/voting/get-eligibility", get(controllers::voting::get_elibibility).options(|| async { StatusCode::OK }))
        .route("/admin/voting/post-question", post(controllers::voting::post_question).options(|| async { StatusCode::OK }))

        .route("/admin/voting/get-rushee", get(controllers::voting::get_rushee).options(|| async { StatusCode::OK }))
        
        .layer(
            CorsLayer::new()
                .allow_origin(Any) // Allow requests from any origin
                .allow_methods([Method::GET, Method::POST, Method::OPTIONS]) // Allow specific HTTP methods
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



