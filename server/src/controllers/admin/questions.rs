use axum::{http::StatusCode, response::Json};
use mongodb::bson::doc;
use serde_json::{json, Value};

use crate::controllers::db;
use crate::models::pis::PISQuestion;
use futures::stream::StreamExt;
use serde::Deserialize;

/**
 * Add a PIS question
 */
pub async fn add_pis_question(Json(payload): Json<PISQuestion>) -> Result<Json<Value>, StatusCode> {
    let connection = db::get_pis_questions_client().await;

    let new_question = PISQuestion {
        question: payload.question,
        question_type: payload.question_type,
        order: payload.order,
        category: payload.category,
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
 * Set (or clear) the category bucket on an existing PIS question.
 * Matched by question text + question_type, same as delete_pis_question.
 * Pass `category: null` to make a question "fixed" (always shown, not
 * part of the randomized bucket draw).
 */
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

    let filter = doc! {"$and": [
        doc! {"question": payload.question},
        doc! {"question_type": payload.question_type}
    ]};

    let update = match &payload.category {
        Some(category) => doc! { "$set": { "category": category } },
        None => doc! { "$unset": { "category": "" } },
    };

    let result = connection.update_one(filter, update).await;

    match result {
        Ok(update_result) if update_result.matched_count > 0 => Ok(Json(json!({
            "status": "success",
            "message": "successfully updated pis question category"
        }))),
        Ok(_) => Ok(Json(json!({
            "status": "error",
            "message": "no matching pis question found"
        }))),
        Err(_err) => Ok(Json(json!({
            "status": "error",
            "message": "failed to update pis question category"
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

#[cfg(test)]
mod tests;
