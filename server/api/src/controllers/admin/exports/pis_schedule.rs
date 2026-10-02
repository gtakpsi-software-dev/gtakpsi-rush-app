use crate::storage::db;
use axum::{http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::doc;
use serde_json::{json, Value};

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

            // Keep the legacy lexical comparison of serialized BSON dates so exported row order stays the same.
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
