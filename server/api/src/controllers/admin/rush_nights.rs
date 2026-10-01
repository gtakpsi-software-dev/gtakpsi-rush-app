use axum::{http::StatusCode, response::Json};
use mongodb::bson::doc;
use serde_json::{json, Value};

use crate::controllers::db;
use crate::middlewares::time_helpers::string_to_bson_datetime;
use crate::models::misc::{IncomingRushNight, RushNight};

pub async fn add_rush_night(
    Json(payload): Json<IncomingRushNight>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rush_nights_client().await;

    let new_rush_night = RushNight {
        time: string_to_bson_datetime(&payload.time),
        name: payload.name,
    };

    match connection.insert_one(new_rush_night).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "successfully added rush night"
        }))),

        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "couldn't add rush night"
        }))),
    }
}

pub async fn delete_rush_night(Json(payload): Json<RushNight>) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rush_nights_client().await;

    // Match the full stored timestamp; the name does not affect this endpoint's lookup.
    match connection.delete_one(doc! {"time": payload.time}).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "successfully deleted rush night"
        }))),

        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "there was an issue while deleting the rush night"
        }))),
    }
}
