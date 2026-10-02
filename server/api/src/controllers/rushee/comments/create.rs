use super::rating_updates::update_global_ratings;
use crate::controllers::db;
use crate::models::{
    misc::RushNight,
    rushee::{Comment, IncomingComment},
};
use crate::services::rush_night_queries;
use crate::services::validation::check_valid_comment;
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::{doc, to_bson};
use serde_json::{json, Value};

fn comment_error(message: &'static str) -> Result<Json<Value>, StatusCode> {
    Ok(Json(json!({ "status": "error", "message": message })))
}

pub async fn post_comment(
    Path(id): Path<String>,
    Json(payload): Json<IncomingComment>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_rushee_client().await;
    let rush_nights = match rush_night_queries::get_rush_nights().await {
        Ok(nights) => nights,
        Err(_) => return comment_error("there was some error while matching the rush night"),
    };
    let Some(active_night) =
        crate::services::rush_nights::current_rush_night(&rush_nights, bson::DateTime::now())
    else {
        return comment_error("no rush nights are configured");
    };
    let Some(rush_night) = rush_nights
        .iter()
        .find(|night| night.name == active_night.name)
    else {
        return comment_error("couldn't match a rush night");
    };

    // Preserve the night serialization gate before any rushee or rating write.
    if to_bson(&rush_night).is_err() {
        return comment_error("some issue occurred when serializing the rush night");
    }

    let my_rush_night = RushNight {
        name: rush_night.name.clone(),
        time: rush_night.time,
    };
    let new_comment = Comment {
        brother_id: payload.brother_id.clone(),
        brother_name: payload.brother_name.clone(),
        comment: payload.comment.clone(),
        ratings: payload.ratings.clone(),
        night: my_rush_night.clone(),
    };

    let rushee = match connection.find_one(doc! { "gtid": id.clone() }).await {
        Ok(Some(rushee)) => rushee,
        Ok(None) => return comment_error("some error occurred"),
        Err(_) => return comment_error("something wrong occurred"),
    };

    if check_valid_comment(&payload.brother_name, &my_rush_night, &rushee.comments)
        .await
        .is_err()
    {
        return comment_error("you have already made a comment for this rush night");
    }

    // Ratings are written before appending the comment; retain that partial-write order.
    if update_global_ratings(&connection, &id, &rushee, &payload.ratings)
        .await
        .is_err()
    {
        return comment_error("there was an error updating the rushee's global ratings");
    }

    let bson_comment = match to_bson(&new_comment) {
        Ok(comment) => comment,
        Err(_) => return comment_error("some error occurred"),
    };
    let filter = doc! { "gtid": id };
    let update = doc! { "$push": { "comments": bson_comment } };

    match connection.update_one(filter, update).await {
        Ok(_) => Ok(Json(json!({
            "status": "success",
            "message": "successfully updated rushee"
        }))),
        Err(_) => comment_error("something wrong occurred"),
    }
}
