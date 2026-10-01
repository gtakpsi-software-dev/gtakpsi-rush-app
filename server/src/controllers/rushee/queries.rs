/**
 * Lookup Summary:
 * - Flattens result handling while keeping the existing list projection.
 * - Preserves response text, missing-ID behavior, and the legacy `stauts` key.
 * - Cursor records retain their original registration-order numbering.
 */
use crate::controllers::db;
use crate::middlewares::{
    attendance,
    rush_nights::{enrich_interactions_by_night, interactions_by_night},
};
use crate::models::rushee::{RusheeModel, StrippedRushee};
use axum::{extract::Path, http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::doc;
use mongodb::Collection;
use serde_json::{json, Value};

pub async fn get_rushees() -> Result<Json<Value>, StatusCode> {
    let collection: Collection<RusheeModel> = db::get_rushee_client().await;
    let rush_nights = attendance::get_rush_nights_sorted()
        .await
        .unwrap_or_default();

    let mut cursor = match collection.find(doc! {}).await {
        Ok(cursor) => cursor,
        Err(_) => {
            // The misspelled key is an existing wire response on this error path.
            return Ok(Json(json!({
                "stauts": "error",
                "message": "some network error occurred"
            })));
        }
    };

    let mut rushees = Vec::<StrippedRushee>::new();
    let mut order: i32 = 1;
    while let Some(result) = cursor.next().await {
        let doc = match result {
            Ok(doc) => doc,
            Err(err) => {
                println!("{}", err.to_string());
                return Ok(Json(json!({
                    "status": "error",
                    "message": "there was an error pushing the stripped rushee to the array"
                })));
            }
        };

        let night_interactions =
            interactions_by_night(&rush_nights, &doc.attendance, &doc.comments);
        // INVARIANT: list responses omit private access codes, comments, and sorting notes.
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

    Ok(Json(json!({
        "status": "success",
        "payload": rushees
    })))
}

pub async fn get_rushee(Path(id): Path<String>) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;

    match connection.find_one(doc! { "gtid": id.clone() }).await {
        Ok(Some(mut rushee)) => {
            if let Ok(rush_nights) = attendance::get_rush_nights_sorted().await {
                enrich_interactions_by_night(&mut rushee, &rush_nights);
            }
            Ok(Json(json!({
                "status": "success",
                "payload": rushee
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

    match connection.find_one(doc! { "gtid": id.clone() }).await {
        Ok(Some(_)) => Ok(Json(json!({
            "status": "error",
            "message": "exists"
        }))),
        Ok(None) => Ok(Json(json!({
            "status": "success",
            "message": format!("Rushee with GTID {} does not exist", id)
        }))),
        Err(_) => Ok(Json(json!({
            "status": "error",
            "message": "Some network error occurred when checking if the rushee exists or not"
        }))),
    }
}
