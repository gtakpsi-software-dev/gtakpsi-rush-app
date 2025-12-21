use axum::{
    extract::Path,
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::{get, post},
    Router,
};
use futures::stream::StreamExt;
use mongodb::bson::doc;
use serde_json::{json, Value};

use crate::{
    middlewares::timeHelpers::{self, string_to_bson_datetime},
    models::{
        misc::{IncomingBrotherName, IncomingRushNight, RushNight},
        pis::{IncomingPISSignup, PISQuestion, PISTimeslot, PISTimeslotIncoming},
        Rushee::StrippedRushee,
    },
};

use super::{db, rushee};

/**
 * Add a PIS question
 */
pub async fn add_pis_question(Json(payload): Json<PISQuestion>) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_questions_client().await;

    let new_question = PISQuestion {
        question: payload.question,
        question_type: payload.question_type,
    };

    let result = connection.insert_one(new_question).await;

    match result {
        Ok(_insert_result) => Ok(Json(json!({
            "status": "success",
            "message": "successfully added pis question"
        }))),
        Err(_err) => Ok(Json(json!({
            "status": "error",
            "message": "failed to add pis question"
        }))),
    }
}

/**
 * Delete a PIS question
 */
pub async fn delete_pis_question(
    Json(payload): Json<PISQuestion>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_questions_client().await;

    let filter = doc! {"$and": [
        doc! {"question": payload.question},
        doc! {"question_type": payload.question_type}
    ]};

    let result = connection.delete_one(filter).await;

    match result {
        Ok(_delete_result) => Ok(Json(json!({
            "status": "success",
            "message": "successfully deleted PIS question"
        }))),
        Err(_err) => Ok(Json(json!({
            "status": "error",
            "message": "some error occurred"
        }))),
    }
}

/**
 * Fetch all the PIS questions
 */
pub async fn get_pis_questions() -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_questions_client().await;
    let result = connection.find(doc! {}).await;

    match result {
        Ok(mut cursor) => {
            let mut pis_questions: Vec<PISQuestion> = Vec::new();

            while let Some(question) = cursor.next().await {
                match question {
                    Ok(doc) => pis_questions.push(doc),
                    Err(err) => {
                        return Ok(Json(json!({
                            "status": "error",
                            "message": "some error occurred"
                        })))
                    }
                }
            }

            Ok(Json(json!({
                "status": "success",
                "payload": pis_questions
            })))
        }

        Err(err) => Ok(Json(json!({
            "status": "error",
            "message": "some error occurred while fetching data"
        }))),
    }
}

/**
 * Add a certain number of PIS timeslots
 * Input must be formatted as a bson DateTime object
 */
pub async fn add_pis_timeslot(
    Json(payload): Json<PISTimeslotIncoming>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_timeslots_client().await;

    let time = timeHelpers::string_to_bson_datetime(&payload.time);

    // check if timeslot exists
    let filter = doc! {"time": time};
    let result = connection.find_one(filter).await;

    match result {
        Ok(find_result) => match find_result {
            Some(timeslot) => {
                let update_filter = doc! {"time": payload.time};
                let update = doc! {"$set": doc! {
                    "num_available": timeslot.num_available + payload.change
                }};

                let update_result = connection.update_one(update_filter, update).await;

                match update_result {
                    Ok(_x) => {
                        return Ok(Json(json!({
                            "status": "success",
                            "message": "added to num_available timeslots"
                        })))
                    }

                    Err(_err) => {
                        return Ok(Json(json!({
                            "status": "error",
                            "message": "some error occurred"
                        })))
                    }
                }
            }

            None => {
                let new_pis_timeslot = PISTimeslot {
                    time: time,
                    num_available: payload.change,
                };

                let add_result = connection.insert_one(new_pis_timeslot).await;

                match add_result {
                    Ok(_x) => {
                        return Ok(Json(json!({
                            "status": "success",
                            "message": "successfully created new pis timeslot"
                        })))
                    }
                    Err(_err) => {
                        return Ok(Json(json!({
                            "status": "error",
                            "message": "some error occurred while creating the PIS timeslot"
                        })))
                    }
                }
            }
        },

        Err(_err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "some error occurred"
            })))
        }
    }
}

/**
 * Delete a certain number of PIS timeslots
 * NOTE: If final number is negative, the timeslot is deleted
 */
pub async fn delete_pis_timeslot(
    Json(payload): Json<PISTimeslotIncoming>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_timeslots_client().await;

    let time = timeHelpers::string_to_bson_datetime(&payload.time);

    // check if timeslot exists
    let filter = doc! {"time": payload.time};
    let result = connection.find_one(filter).await;

    match result {
        Ok(find_result) => match find_result {
            Some(timeslot) => {
                if timeslot.num_available < payload.change {
                    // delete timeslot
                    let delete_filter = doc! {"time": time};

                    let delete_result = connection.delete_one(delete_filter).await;

                    match delete_result {
                        Ok(_x) => Ok(Json(json!({
                            "status": "success",
                            "message": "successfully deleted timeslot"
                        }))),

                        Err(_err) => Ok(Json(json!({
                            "status": "error",
                            "message": "couldn't delete timeslot"
                        }))),
                    }
                } else {
                    let update_filter = doc! {"time": time};
                    let update = doc! {"$set": doc! {
                        "num_available": timeslot.num_available + payload.change
                    }};

                    let update_result = connection.update_one(update_filter, update).await;

                    match update_result {
                        Ok(_x) => {
                            return Ok(Json(json!({
                                "status": "success",
                                "message": "subtracted from num_available timeslots"
                            })))
                        }

                        Err(_err) => {
                            return Ok(Json(json!({
                                "status": "error",
                                "message": "some error occurred"
                            })))
                        }
                    }
                }
            }

            None => {
                return Ok(Json(json!({
                    "status": "error",
                    "message": "pis timeslot doesn't exist"
                })))
            }
        },

        Err(_err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "some error occurred"
            })))
        }
    }
}

/**
 * Fetch all the PIS timeslots
 */
pub async fn get_pis_timeslots() -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_timeslots_client().await;

    let result = connection.find(doc! {}).await;

    match result {
        Ok(mut cursor) => {
            let mut pis_timeslots: Vec<PISTimeslot> = Vec::new();

            while let Some(timeslot) = cursor.next().await {
                match timeslot {
                    Ok(doc) => pis_timeslots.push(doc),
                    Err(err) => {
                        return Ok(Json(json!({
                            "status": "error",
                            "message": "some error occurred"
                        })))
                    }
                }
            }

            Ok(Json(json!({
                "status": "success",
                "payload": pis_timeslots
            })))
        }

        Err(err) => Ok(Json(json!({
            "status": "error",
            "message": "some error occurred while fetching data"
        }))),
    }
}

/**
 * Add Rush Night
 */
pub async fn add_rush_night(
    Json(payload): Json<IncomingRushNight>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rush_nights_client().await;

    let new_rush_night = RushNight {
        time: string_to_bson_datetime(&payload.time),
        name: payload.name,
    };

    let result = connection.insert_one(new_rush_night).await;

    match result {
        Ok(_insert_result) => Ok(Json(json!({
            "status": "success",
            "message": "successfully added rush night"
        }))),

        Err(_err) => Ok(Json(json!({
            "status": "error",
            "message": "couldn't add rush night"
        }))),
    }
}

/**
 * Delete a Rush Night
 * Fix this later -> make it only date, right now the time is set to 12:00 PM, or should be
 */
pub async fn delete_rush_night(Json(payload): Json<RushNight>) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rush_nights_client().await;

    let filter = doc! {"time": payload.time};
    let result = connection.delete_one(filter).await;

    match result {
        Ok(_delete_result) => Ok(Json(json!({
            "status": "success",
            "message": "successfully deleted rush night"
        }))),

        Err(_err) => Ok(Json(json!({
            "status": "error",
            "message": "there was an issue while deleting the rush night"
        }))),
    }
}

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

                            rushees.push(StrippedRushee {
                                name: format!("{} {}", doc.first_name, doc.last_name),
                                class: doc.class,
                                gtid: doc.gtid,
                                major: doc.major,
                                ratings: doc.ratings,
                                image_url: doc.image_url,
                                email: doc.email,
                                pronouns: doc.pronouns,
                                attendance: doc.attendance,
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
