use crate::controllers::db;
use axum::{http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::doc;
use serde_json::{json, Value};

pub async fn export_rushee_personal_info() -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    let result = connection.find(doc! {}).await;

    match result {
        Ok(mut cursor) => {
            let mut rushees_info = Vec::<serde_json::Value>::new();

            while let Some(rushee) = cursor.next().await {
                match rushee {
                    Ok(doc) => {
                        rushees_info.push(json!({
                            "first_name": doc.first_name,
                            "last_name": doc.last_name,
                            "gtid": doc.gtid,
                            "email": doc.email,
                            "phone_number": doc.phone_number,
                            "housing": doc.housing,
                            "major": doc.major,
                            "class": doc.class,
                            "pronouns": doc.pronouns,
                            "exposure": doc.exposure,
                        }));
                    }
                    Err(err) => {
                        println!("{}", err.to_string());
                        return Ok(Json(json!({
                            "status": "error",
                            "message": "Error reading rushee data"
                        })));
                    }
                }
            }

            Ok(Json(json!({
                "status": "success",
                "payload": rushees_info
            })))
        }

        Err(_err) => Ok(Json(json!({
            "status": "error",
            "message": "Database error"
        }))),
    }
}
