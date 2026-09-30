use axum::{http::StatusCode, response::Json};
use mongodb::bson::doc;
use serde_json::{json, Value};

use crate::controllers::db;
use crate::middlewares::time_helpers::string_to_bson_datetime;
use crate::models::misc::{IncomingRushNight, RushNight};

/**
 * Add Rush Night
 */
pub async fn add_rush_night(
    Json(payload): Json<IncomingRushNight>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rush_nights_client().await;

    let new_rush_night = RushNight {
        time: string_to_bson_datetime(&payload.time),
        name: payload.name,
    };

    let result = connection.insert_one(new_rush_night).await;

    match result {
        Ok(_insert_result) => Ok(Json(json!({
            "status": "success",
            "message": "successfully added rush night"
        }))),

        Err(_err) => Ok(Json(json!({
            "status": "error",
            "message": "couldn't add rush night"
        }))),
    }
}

/**
 * Delete a Rush Night
 * Fix this later -> make it only date, right now the time is set to 12:00 PM, or should be
 */
pub async fn delete_rush_night(Json(payload): Json<RushNight>) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rush_nights_client().await;

    let filter = doc! {"time": payload.time};
    let result = connection.delete_one(filter).await;

    match result {
        Ok(_delete_result) => Ok(Json(json!({
            "status": "success",
            "message": "successfully deleted rush night"
        }))),

        Err(_err) => Ok(Json(json!({
            "status": "error",
            "message": "there was an issue while deleting the rush night"
        }))),
    }
}
