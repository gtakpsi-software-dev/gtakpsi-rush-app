use crate::services::rush_night_queries;
use crate::storage::db;
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::doc;
use mongodb::bson::to_bson;
use serde_json::{json, Value};

// Return configured and default rush nights in chronological order.
pub async fn get_rush_nights() -> Result<Json<Value>, StatusCode> {
    match rush_night_queries::get_rush_nights_sorted().await {
        Ok(nights) => Ok(Json(json!({
            "status": "success",
            "payload": nights
        }))),
        Err(_err) => Ok(Json(json!({
            "status": "error",
            "message": "could not load rush nights"
        }))),
    }
}

// Add the currently active configured rush night to a rushee's attendance.
pub async fn update_attendance(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let fetch_rush_nights = rush_night_queries::get_rush_nights().await;
    let connection = db::get_rushee_collection().await;

    let rush_nights = match fetch_rush_nights {
        Ok(nights) => nights,
        Err(_) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "some error occurred"
            })))
        }
    };
    let Some(active_night) =
        crate::services::rush_nights::current_rush_night(&rush_nights, bson::DateTime::now())
    else {
        return Ok(Json(json!({
            "status": "error",
            "message": "no rush nights are configured"
        })));
    };

    // Retain the first matching stored night when names repeat, as the original scan did.
    let Some(candidate_night) = rush_nights
        .iter()
        .find(|night| night.name == active_night.name)
    else {
        return Ok(Json(json!({
            "status": "error",
            "message": "rush night does not exist"
        })));
    };
    let bson_night = match to_bson(candidate_night) {
        Ok(night) => night,
        Err(_) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "some issue occurred when serializing the rush night"
            })))
        }
    };

    let filter = doc! {"gtid": id.clone()};
    let update = doc! {"$addToSet": {
        "attendance": bson_night,
    }};

    // A successful write keeps the established response even if no GTID matched.
    match connection.update_one(filter, update).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "updated rushee attendance"
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "couldn't update rushee attendance"
        }))),
    }
}
