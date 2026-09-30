use crate::controllers::db;
use crate::middlewares::{
    attendance,
    rush_nights::{enrich_interactions_by_night, interactions_by_night},
};
use crate::models::rushee::{RusheeModel, RusheeSelfView, StrippedRushee};
use axum::extract::Query;
use axum::{extract::Path, http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::doc;
use mongodb::Collection;
use serde::Deserialize;
use serde_json::{json, Value};

pub async fn get_rushees() -> Result<Json<Value>, StatusCode> {
    let collection: Collection<RusheeModel> = db::get_rushee_client().await;
    let rush_nights = attendance::get_rush_nights_sorted()
        .await
        .unwrap_or_default();

    let result = collection
        .find({
            doc! {}
        })
        .await;

    match result {
        Ok(mut cursor) => {
            // TODO: extract useful info only
            let mut rushees = Vec::<StrippedRushee>::new();
            let mut order: i32 = 1; // Start at 1 for registration order

            while let Some(rushee) = cursor.next().await {
                match rushee {
                    Ok(doc) => {
                        let night_interactions =
                            interactions_by_night(&rush_nights, &doc.attendance, &doc.comments);
                        rushees.push(StrippedRushee {
                            name: format!("{} {}", doc.first_name, doc.last_name),
                            first_name: doc.first_name.clone(),
                            last_name: doc.last_name.clone(),
                            class: doc.class,
                            gtid: doc.gtid,
                            major: doc.major,
                            ratings: doc.ratings,
                            image_url: doc.image_url,
                            email: doc.email,
                            pronouns: doc.pronouns,
                            attendance: doc.attendance,
                            registration_order: order,
                            pis_timeslot: Some(doc.pis_timeslot),
                            interactions_by_night: night_interactions,
                        });
                        order += 1;
                    }
                    Err(err) => {
                        println!("{}", err.to_string());
                        return Ok(Json(json!({
                            "status": "error",
                            "message": "there was an error pushing the stripped rushee to the array"
                        })));
                    }
                }
            }

            Ok(Json(json!({
                "status": "success",
                "payload": rushees
            })))
        }

        Err(err) => Ok(Json(json!({
            "stauts": "error",
            "message": "some network error occurred"
        }))),
    }
}

// returns comments, ratings, etc..
pub async fn get_rushee(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    let result = connection.find_one(doc! {"gtid": id.clone()}).await;

    match result {
        Ok(insert_result) => match insert_result {
            Some(mut rushee) => {
                if let Ok(rush_nights) = attendance::get_rush_nights_sorted().await {
                    enrich_interactions_by_night(&mut rushee, &rush_nights);
                }
                Ok(Json(json!({
                    "status": "success",
                    "payload": rushee
                })))
            }

            None => Ok(Json(json!({
                "status": "error",
                "message": format!("Rushee with GTID {} does not exist", id)
            }))),
        },

        Err(err) => Ok(Json(json!({
            "status": "error",
            "message": "some network error occurred when fetching the rushee"
        }))),
    }
}

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

pub async fn does_rushee_exist(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    let result = connection.find_one(doc! {"gtid": id.clone()}).await;

    match result {
        Ok(insert_result) => match insert_result {
            Some(rushee) => Ok(Json(
                (json!({
                    "status": "error",
                    "message": format!("exists")
                })),
            )),

            None => Ok(Json(json!({
                "status": "success",
                "message": format!("Rushee with GTID {} does not exist", id)
            }))),
        },

        Err(err) => Ok(Json(json!({
            "status": "error",
            "message": "Some network error occurred when checking if the rushee exists or not"
        }))),
    }
}

#[cfg(test)]
mod tests;
