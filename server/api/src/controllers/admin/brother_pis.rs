use crate::models::{brother::IncomingBrotherName, pis::PISSignup, rushee::StrippedRushee};
use crate::services::rush_nights::interactions_by_night;
use crate::storage::{cursor_rows::for_each_strict_row, db};
use axum::{http::StatusCode, response::Json};
use mongodb::bson::doc;
use serde_json::{json, Value};

mod signup;
pub use signup::brother_pis_sign_up;

// Check whether either interviewer slot exactly matches the supplied brother name.
fn signed_up_with(signup: &PISSignup, brother: &IncomingBrotherName) -> bool {
    (signup.first_brother_first_name.eq(&brother.first_name)
        && signup.first_brother_last_name.eq(&brother.last_name))
        || (signup.second_brother_first_name.eq(&brother.first_name)
            && signup.second_brother_last_name.eq(&brother.last_name))
}

// Return list summaries for rushees assigned to the supplied brother name.
pub async fn get_brother_pis(
    Json(payload): Json<IncomingBrotherName>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_collection().await;
    let rush_nights = crate::services::rush_night_queries::get_rush_nights_sorted()
        .await
        .unwrap_or_default();

    let result = connection.find(doc! {}).await;

    match result {
        Ok(cursor) => {
            let mut rushees = Vec::<StrippedRushee>::new();

            if let Err(err) = for_each_strict_row(cursor, |doc| {
                if signed_up_with(&doc.pis_signup, &payload) {
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
            })
            .await
            {
                println!("{err}");
                return Ok(Json(json!({
                    "status": "error",
                    "message": "there was an error pushing the stripped rushee to the array"
                })));
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
