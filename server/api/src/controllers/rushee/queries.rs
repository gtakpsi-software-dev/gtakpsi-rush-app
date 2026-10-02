use crate::services::rush_night_queries;
use crate::services::rush_nights::enrich_interactions_by_night;
use crate::storage::db;
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::doc;
use serde_json::{json, Value};

use super::read_rows::map_rushee_rows;

mod list_projection;
use list_projection::project_list_rushee;

pub async fn get_rushees() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_rushee_client().await;
    let rush_nights = rush_night_queries::get_rush_nights_sorted()
        .await
        .unwrap_or_default();

    let mut order: i32 = 1;
    let rushees = map_rushee_rows(collection, |rushee| {
        let projected = project_list_rushee(rushee, &rush_nights, order);
        order += 1;
        projected
    })
    .await;

    match rushees {
        Ok(payload) => Ok(Json(json!({"status": "success", "payload": payload}))),
        Err(response) => Ok(response),
    }
}

pub async fn get_rushee(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    match connection.find_one(doc! { "gtid": id.clone() }).await {
        Ok(Some(mut rushee)) => {
            if let Ok(rush_nights) = rush_night_queries::get_rush_nights_sorted().await {
                enrich_interactions_by_night(&mut rushee, &rush_nights);
            }
            Ok(Json(json!({
                "status": "success",
                "payload": rushee
            })))
        }
        Ok(None) => Ok(Json(json!({
            "status": "error",
            "message": format!("Rushee with GTID {} does not exist", id)
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "some network error occurred when fetching the rushee"
        }))),
    }
}

pub async fn does_rushee_exist(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    match connection.find_one(doc! { "gtid": id.clone() }).await {
        Ok(Some(_)) => Ok(Json(json!({
            "status": "error",
            "message": "exists"
        }))),
        Ok(None) => Ok(Json(json!({
            "status": "success",
            "message": format!("Rushee with GTID {} does not exist", id)
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Some network error occurred when checking if the rushee exists or not"
        }))),
    }
}
