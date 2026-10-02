use axum::{http::StatusCode, response::Json};
use serde_json::{json, Value};

use super::read_rushees::map_rushees;

pub async fn export_rushee_personal_info() -> Result<Json<Value>, StatusCode> {
    let rows = map_rushees(|rushee| {
        json!({
            "first_name": rushee.first_name,
            "last_name": rushee.last_name,
            "gtid": rushee.gtid,
            "email": rushee.email,
            "phone_number": rushee.phone_number,
            "housing": rushee.housing,
            "major": rushee.major,
            "class": rushee.class,
            "pronouns": rushee.pronouns,
            "exposure": rushee.exposure,
        })
    })
    .await;

    match rows {
        Ok(payload) => Ok(Json(json!({"status": "success", "payload": payload}))),
        Err(response) => Ok(response),
    }
}
