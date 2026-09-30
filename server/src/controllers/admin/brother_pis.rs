use crate::controllers::db;
use crate::middlewares::rush_nights::interactions_by_night;
use crate::models::{misc::IncomingBrotherName, pis::IncomingPISSignup, rushee::StrippedRushee};
use axum::extract::Path;
use axum::{http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::doc;
use serde_json::{json, Value};

pub async fn brother_pis_sign_up(
    Path(id): Path<String>,
    Json(payload): Json<IncomingPISSignup>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;
    let fetch_rushee = connection.find_one(doc! {"gtid": id.clone()}).await;

    match fetch_rushee {
        Ok(rushee_option) => match rushee_option {
            Some(rushee) => {
                if (rushee.pis_signup.first_brother_first_name == "none"
                    && rushee.pis_signup.first_brother_last_name == "none")
                {
                    // update first and last name
                    let update = doc! {"$set": {"pis_signup.first_brother_first_name": payload.brother_first_name}};
                    let first_name_update = connection
                        .update_one(doc! {"gtid": id.clone()}, update)
                        .await;

                    match first_name_update {
                        Ok(_first_result) => {
                            let last_update = doc! {"$set": {"pis_signup.first_brother_last_name": payload.brother_last_name}};
                            let last_name_update = connection
                                .update_one(doc! {"gtid": id.clone()}, last_update)
                                .await;

                            match last_name_update {
                                Ok(_result) => {
                                    return Ok(Json(json!({
                                        "status": "success",
                                        "message": "Successfully registered!"
                                    })))
                                }

                                Err(_err) => {
                                    return Ok(Json(json!({
                                        "status": "error",
                                        "message": "Couldn't update the PIS Signup for last name"
                                    })))
                                }
                            }
                        }

                        Err(_err) => {
                            return Ok(Json(json!({
                                "status": "error",
                                "message": "Couldn't update the PIS Signup for first name"
                            })))
                        }
                    }
                } else if (rushee.pis_signup.second_brother_first_name == "none"
                    && rushee.pis_signup.second_brother_last_name == "none")
                {
                    // check if duplicate brother
                    if (rushee.pis_signup.first_brother_first_name == payload.brother_first_name
                        && rushee.pis_signup.first_brother_last_name == payload.brother_last_name)
                    {
                        return Ok(Json(json!({
                            "status": "error",
                            "message": format!("Brother {} {} has already registered for this PIS.", payload.brother_first_name, payload.brother_last_name)
                        })));
                    }

                    // update first and last name
                    let update = doc! {"$set": {"pis_signup.second_brother_first_name": payload.brother_first_name}};
                    let first_name_update = connection
                        .update_one(doc! {"gtid": id.clone()}, update)
                        .await;

                    match first_name_update {
                        Ok(_first_result) => {
                            let last_update = doc! {"$set": {"pis_signup.second_brother_last_name": payload.brother_last_name}};
                            let last_name_update = connection
                                .update_one(doc! {"gtid": id.clone()}, last_update)
                                .await;

                            match last_name_update {
                                Ok(_result) => {
                                    return Ok(Json(json!({
                                        "status": "success",
                                        "message": "Successfully registered for PIS!"
                                    })))
                                }

                                Err(_err) => {
                                    return Ok(Json(json!({
                                        "status": "error",
                                        "message": "Couldn't update the PIS Signup for last name"
                                    })))
                                }
                            }
                        }

                        Err(_err) => {
                            return Ok(Json(json!({
                                "status": "error",
                                "message": "Couldn't update the PIS Signup for first name"
                            })))
                        }
                    }
                } else {
                    return Ok(Json(json!({
                        "status": "error",
                        "message": format!("Two brothers ({} {} and {} {}) are already signed up",
                                            rushee.pis_signup.first_brother_first_name,
                                            rushee.pis_signup.first_brother_last_name,
                                            rushee.pis_signup.second_brother_first_name,
                                            rushee.pis_signup.second_brother_last_name)
                    })));
                }
            }
            None => {
                return Ok(Json(json!({
                    "status": "error",
                    "message": format!("The rushee with GTID {} does not exist", id.clone())
                })))
            }
        },

        Err(_err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "Couldn't access the MongoDB database"
            })))
        }
    }
}

pub async fn get_brother_pis(
    Json(payload): Json<IncomingBrotherName>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;
    let rush_nights = crate::middlewares::attendance::get_rush_nights_sorted()
        .await
        .unwrap_or_default();

    let result = connection
        .find({
            doc! {}
        })
        .await;

    match result {
        Ok(mut cursor) => {
            // TODO: extract useful info only
            let mut rushees = Vec::<StrippedRushee>::new();

            while let Some(rushee) = cursor.next().await {
                match rushee {
                    Ok(doc) => {
                        if ((doc
                            .pis_signup
                            .first_brother_first_name
                            .eq(&payload.first_name)
                            && doc
                                .pis_signup
                                .first_brother_last_name
                                .eq(&payload.last_name))
                            || (doc.pis_signup.second_brother_first_name).eq(&payload.first_name)
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

        Err(err) => Ok(Json(json!({
            "stauts": "error",
            "message": "some network error occurred"
        }))),
    }
}
