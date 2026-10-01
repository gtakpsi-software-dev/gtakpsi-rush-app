use crate::controllers::db;
use crate::models::rushee::RusheeSelfView;
use axum::extract::{Path, Query};
use axum::{http::StatusCode, response::Json};
use mongodb::bson::doc;
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Debug, Deserialize)]
pub struct SelfViewParams {
    code: Option<String>,
}

/// Public self-service view for a rushee's own record (used by the
/// `/rushee/:gtid/:link` page). Requires the rushee's access code as a
/// `?code=` query param, validated server-side, and returns only a safe
/// subset of fields — never comments, sorting notes/status, ratings, or the
/// access code itself, since those are internal to bid committee/brothers.
pub async fn get_rushee_self(
    Path(id): Path<String>,
    Query(params): Query<SelfViewParams>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    let result = connection.find_one(doc! {"gtid": id.clone()}).await;

    match result {
        Ok(Some(rushee)) => {
            let provided_code = params.code.unwrap_or_default();
            if provided_code.is_empty() || provided_code != rushee.access_code {
                return Ok(Json(json!({
                    "status": "error",
                    "message": "Invalid access code"
                })));
            }

            let view: RusheeSelfView = rushee.into();
            Ok(Json(json!({
                "status": "success",
                "payload": view
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn self_service_query_distinguishes_missing_empty_and_supplied_codes() {
        for (query, expected) in [
            (json!({}), None),
            (json!({"code": ""}), Some("")),
            (json!({"code": "provided"}), Some("provided")),
        ] {
            let params: SelfViewParams = serde_json::from_value(query).unwrap();
            assert_eq!(params.code.as_deref(), expected);
        }
    }
}
