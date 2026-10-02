use crate::storage::db;
use axum::{http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::doc;
use serde_json::{json, Value};

pub async fn export_rushee_numbers() -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    let result = connection.find(doc! {}).await;

    match result {
        Ok(mut cursor) => {
            let mut rushee_mappings = Vec::<serde_json::Value>::new();
            let mut order: i32 = 1;

            while let Some(rushee) = cursor.next().await {
                match rushee {
                    Ok(doc) => {
                        rushee_mappings.push(json!({
                            "rushee_number": format!("{:03}", order),
                            "name": format!("{} {}", doc.first_name, doc.last_name),
                            "gtid": doc.gtid,
                        }));
                        order += 1;
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
                "payload": rushee_mappings
            })))
        }

        Err(_err) => Ok(Json(json!({
            "status": "error",
            "message": "Database error"
        }))),
    }
}
