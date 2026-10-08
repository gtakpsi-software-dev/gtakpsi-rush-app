use axum::{http::StatusCode, response::Json};
use mongodb::bson::{doc, Document};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::models::pis::PISQuestion;
use crate::storage::{cursor_rows::collect_strict_rows, db};

// Build an exact-match filter for a question and its type.
fn question_identity_filter(question: &str, question_type: &str) -> Document {
    // INVARIANT: update and delete match the same exact question/type pair.
    doc! {"$and": [
        doc! {"question": question},
        doc! {"question_type": question_type}
    ]}
}

// Build a PIS question response containing a status and message.
fn question_message(status: &str, message: &str) -> Json<Value> {
    Json(json!({"status": status, "message": message}))
}

// Insert a PIS question and report whether the database write succeeded.
pub async fn add_pis_question(Json(payload): Json<PISQuestion>) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_questions_collection().await;
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

// Set or remove the category of the matching PIS question.
pub async fn update_pis_question_category(
    Json(payload): Json<UpdatePisQuestionCategoryPayload>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_questions_collection().await;

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

// Delete one PIS question matching the supplied text and type.
pub async fn delete_pis_question(
    Json(payload): Json<PISQuestion>,
) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_questions_collection().await;

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

// Return all PIS questions, reporting query or row-decoding failures.
pub async fn get_pis_questions() -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_questions_collection().await;
    let cursor = match connection.find(doc! {}).await {
        Ok(cursor) => cursor,
        Err(_) => {
            return Ok(question_message(
                "error",
                "some error occurred while fetching data",
            ))
        }
    };

    let pis_questions: Vec<PISQuestion> = match collect_strict_rows(cursor).await {
        Ok(questions) => questions,
        Err(_) => return Ok(question_message("error", "some error occurred")),
    };

    Ok(Json(json!({
        "status": "success",
        "payload": pis_questions
    })))
}

#[cfg(test)]
mod tests;
