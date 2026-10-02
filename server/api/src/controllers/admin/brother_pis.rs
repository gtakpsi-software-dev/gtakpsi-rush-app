use crate::controllers::db;
use crate::models::{misc::IncomingBrotherName, rushee::StrippedRushee};
use crate::services::rush_nights::interactions_by_night;
use axum::{http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::doc;
use serde_json::{json, Value};

mod signup;
pub use signup::brother_pis_sign_up;
mod slot_selection;

pub async fn get_brother_pis(
    Json(payload): Json<IncomingBrotherName>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;
    let rush_nights = crate::middlewares::attendance::get_rush_nights_sorted()
        .await
        .unwrap_or_default();

    let result = connection.find(doc! {}).await;

    match result {
        Ok(mut cursor) => {
            let mut rushees = Vec::<StrippedRushee>::new();

            while let Some(rushee) = cursor.next().await {
                match rushee {
                    Ok(doc) => {
                        if (doc
                            .pis_signup
                            .first_brother_first_name
                            .eq(&payload.first_name)
                            && doc
                                .pis_signup
                                .first_brother_last_name
                                .eq(&payload.last_name))
                            || (doc
                                .pis_signup
                                .second_brother_first_name
                                .eq(&payload.first_name)
                                && doc
                                    .pis_signup
                                    .second_brother_last_name
                                    .eq(&payload.last_name))
                        {
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
                                registration_order: 0, // Not used in this context
                                pis_timeslot: Some(doc.pis_timeslot),
                                interactions_by_night: night_interactions,
                            });
                        }
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

        Err(_) => Ok(Json(json!({
            "stauts": "error",
            "message": "some network error occurred"
        }))),
    }
}
