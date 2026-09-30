use crate::controllers::db;
use axum::{http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::doc;
use serde_json::{json, Value};

/**
 * Export rushee number mapping as CSV data
 * Returns array of objects with rushee_number and name for CSV export
 */
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

/**
 * Export all rushee personal/registration info (PII) for spreadsheet download.
 * Returns: first_name, last_name, gtid, email, phone_number, housing, major, class, pronouns, exposure
 */
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

/// Export PIS schedule with brother assignments as CSV data
pub async fn export_pis_with_brothers() -> Result<Json<Value>, StatusCode> {
    let collection = db::get_rushee_client().await;

    match collection.find(doc! {}).await {
        Ok(mut cursor) => {
            let mut export_data: Vec<serde_json::Value> = Vec::new();

            while let Some(item) = cursor.next().await {
                if let Ok(rushee) = item {
                    export_data.push(json!({
                        "rushee_name": format!("{} {}", rushee.first_name, rushee.last_name),
                        "timeslot": rushee.pis_timeslot,
                        "brother_1": format!("{} {}",
                            rushee.pis_signup.first_brother_first_name,
                            rushee.pis_signup.first_brother_last_name
                        ),
                        "brother_2": format!("{} {}",
                            rushee.pis_signup.second_brother_first_name,
                            rushee.pis_signup.second_brother_last_name
                        )
                    }));
                }
            }

            // Sort by timeslot
            export_data.sort_by(|a, b| {
                let ts_a = a["timeslot"]["$date"]["$numberLong"]
                    .as_str()
                    .unwrap_or("0");
                let ts_b = b["timeslot"]["$date"]["$numberLong"]
                    .as_str()
                    .unwrap_or("0");
                ts_a.cmp(ts_b)
            });

            Ok(Json(json!({
                "status": "success",
                "payload": export_data
            })))
        }
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Failed to export data"
        }))),
    }
}
