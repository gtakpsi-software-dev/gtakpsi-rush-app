use axum::{http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::{doc, Document};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::controllers::db;
use crate::models::pis::PISQuestion;

fn question_identity_filter(question: &str, question_type: &str) -> Document {
    // INVARIANT: update and delete match the same exact question/type pair.
    doc! {"$and": [
        doc! {"question": question},
        doc! {"question_type": question_type}
    ]}
}

fn question_message(status: &str, message: &str) -> Json<Value> {
    Json(json!({"status": status, "message": message}))
}

pub async fn add_pis_question(Json(payload): Json<PISQuestion>) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_questions_client().await;
    let result = connection.insert_one(payload).await;

    match result {
        Ok(_insert_result) => Ok(question_message(
            "success",
            "successfully added pis question",
        )),
        Err(_err) => Ok(question_message("error", "failed to add pis question")),
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdatePisQuestionCategoryPayload {
    pub question: String,
    pub question_type: String,
    pub category: Option<String>,
}

pub async fn update_pis_question_category(
    Json(payload): Json<UpdatePisQuestionCategoryPayload>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_questions_client().await;

    let filter = question_identity_filter(&payload.question, &payload.question_type);

    // INVARIANT: null removes the category so the interview selector treats it as fixed.
    let update = match &payload.category {
        Some(category) => doc! { "$set": { "category": category } },
        None => doc! { "$unset": { "category": "" } },
    };

    let result = connection.update_one(filter, update).await;

    match result {
        Ok(update_result) if update_result.matched_count > 0 => Ok(question_message(
            "success",
            "successfully updated pis question category",
        )),
        Ok(_) => Ok(question_message("error", "no matching pis question found")),
        Err(_err) => Ok(question_message(
            "error",
            "failed to update pis question category",
        )),
    }
}

pub async fn delete_pis_question(
    Json(payload): Json<PISQuestion>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_questions_client().await;

    let filter = question_identity_filter(&payload.question, &payload.question_type);

    let result = connection.delete_one(filter).await;

    match result {
        Ok(_delete_result) => Ok(question_message(
            "success",
            "successfully deleted PIS question",
        )),
        Err(_err) => Ok(question_message("error", "some error occurred")),
    }
}

pub async fn get_pis_questions() -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_questions_client().await;
    let mut cursor = match connection.find(doc! {}).await {
        Ok(cursor) => cursor,
        Err(_) => {
            return Ok(question_message(
                "error",
                "some error occurred while fetching data",
            ))
        }
    };

    let mut pis_questions: Vec<PISQuestion> = Vec::new();
    while let Some(question) = cursor.next().await {
        match question {
            Ok(doc) => pis_questions.push(doc),
            Err(_) => return Ok(question_message("error", "some error occurred")),
        }
    }

    Ok(Json(json!({
        "status": "success",
        "payload": pis_questions
    })))
}

#[cfg(test)]
mod tests;
