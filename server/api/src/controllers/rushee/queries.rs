/**
 * Lookup Summary:
 * - Isolates list projection so fields exposed from stored records stay explicit.
 * - Preserves cursor-order numbering, response text, and the legacy `stauts` key.
 */
use crate::controllers::db;
use crate::middlewares::{attendance, rush_nights::enrich_interactions_by_night};
use crate::models::rushee::{RusheeModel, StrippedRushee};
use axum::{extract::Path, http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::doc;
use mongodb::Collection;
use serde_json::{json, Value};

mod list_projection;
use list_projection::project_list_rushee;

pub async fn get_rushees() -> Result<Json<Value>, StatusCode> {
    let collection: Collection<RusheeModel> = db::get_rushee_client().await;
    let rush_nights = attendance::get_rush_nights_sorted()
        .await
        .unwrap_or_default();

    let mut cursor = match collection.find(doc! {}).await {
        Ok(cursor) => cursor,
        Err(_) => {
            // The misspelled key is an existing wire response on this error path.
            return Ok(Json(json!({
                "stauts": "error",
                "message": "some network error occurred"
            })));
        }
    };

    let mut rushees = Vec::<StrippedRushee>::new();
    let mut order: i32 = 1;
    while let Some(result) = cursor.next().await {
        let doc = match result {
            Ok(doc) => doc,
            Err(err) => {
                println!("{}", err.to_string());
                return Ok(Json(json!({
                    "status": "error",
                    "message": "there was an error pushing the stripped rushee to the array"
                })));
            }
        };

        rushees.push(project_list_rushee(doc, &rush_nights, order));
        order += 1;
    }

    Ok(Json(json!({
        "status": "success",
        "payload": rushees
    })))
}

pub async fn get_rushee(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    match connection.find_one(doc! { "gtid": id.clone() }).await {
        Ok(Some(mut rushee)) => {
            if let Ok(rush_nights) = attendance::get_rush_nights_sorted().await {
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
