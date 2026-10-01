use crate::controllers::db;
use crate::models::pis::PISQuestion;
use axum::{extract::Path, http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::{doc, to_bson};
use serde_json::{json, Value};

use super::selection::{category_buckets, draw_one_per_bucket};

/// How long before a rushee's PIS timeslot their randomized bucket
/// questions become visible/get assigned.
const PIS_QUESTION_REVEAL_LEAD_MINUTES: i64 = 10;

fn sort_pis_questions(questions: &mut Vec<PISQuestion>) {
    questions.sort_by_key(|q| q.order.unwrap_or(i32::MAX));
}

fn question_response(
    available: bool,
    reveal_at: bson::DateTime,
    mut questions: Vec<PISQuestion>,
) -> Json<Value> {
    // Keep a single stable sort so equal-order fixed and assigned questions retain their order.
    sort_pis_questions(&mut questions);
    Json(json!({
        "status": "success",
        "payload": {
            "available": available,
            "reveal_at": reveal_at,
            "questions": questions
        }
    }))
}

/**
 * Returns the PIS questions a rushee should be asked for their interview:
 * - Any question with no category (fixed/logistics/bid-decision questions)
 *   is always included.
 * - Any question with a category is part of a random-draw bucket: exactly
 *   one question per category is randomly chosen and, once chosen, persisted
 *   permanently on the rushee's document so reloading or having multiple
 *   brothers open the page doesn't re-roll the set.
 * - The bucketed questions are hidden (not drawn, not returned) until
 *   PIS_QUESTION_REVEAL_LEAD_MINUTES before the rushee's pis_timeslot.
 */
pub async fn get_pis_interview_questions(
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let rushee_connection = db::get_rushee_client().await;

    let rushee = match rushee_connection.find_one(doc! {"gtid": id.clone()}).await {
        Ok(Some(rushee)) => rushee,
        Ok(None) => {
            return Ok(Json(json!({
                "status": "error",
                "message": format!("Rushee with GTID {} does not exist", id)
            })))
        }
        Err(_err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "some network error occurred when fetching the rushee"
            })))
        }
    };

    let questions_connection = db::get_pis_questions_client().await;
    let mut all_questions: Vec<PISQuestion> = Vec::new();
    match questions_connection.find(doc! {}).await {
        Ok(mut cursor) => {
            while let Some(question) = cursor.next().await {
                if let Ok(q) = question {
                    all_questions.push(q);
                }
            }
        }
        Err(_err) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "some error occurred while fetching pis questions"
            })))
        }
    };

    let fixed_questions: Vec<PISQuestion> = all_questions
        .iter()
        .filter(|q| q.category.is_none())
        .cloned()
        .collect();

    let reveal_at_millis =
        rushee.pis_timeslot.timestamp_millis() - (PIS_QUESTION_REVEAL_LEAD_MINUTES * 60 * 1000);
    let now_millis = bson::DateTime::now().timestamp_millis();
    let available = now_millis >= reveal_at_millis;

    if !available {
        return Ok(question_response(
            false,
            rushee.pis_timeslot,
            fixed_questions,
        ));
    }

    // Already assigned previously? Return the persisted set as-is.
    if let Some(assigned) = rushee.assigned_pis_questions {
        if !assigned.is_empty() {
            let questions: Vec<PISQuestion> = fixed_questions
                .into_iter()
                .chain(assigned.into_iter())
                .collect();
            return Ok(question_response(true, rushee.pis_timeslot, questions));
        }
    }

    // First time within the reveal window: randomly draw one question per category.
    let by_category = category_buckets(all_questions);

    // Scoped so the (non-Send) ThreadRng is dropped before any `.await` below.
    let assigned_questions: Vec<PISQuestion> = {
        let mut rng = rand::thread_rng();
        draw_one_per_bucket(by_category, &mut rng)
    };

    let assigned_bson = match to_bson(&assigned_questions) {
        Ok(b) => b,
        Err(_) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "failed to serialize assigned pis questions"
            })))
        }
    };

    let filter = doc! {"gtid": id.clone()};
    let update = doc! { "$set": { "assigned_pis_questions": assigned_bson } };
    if let Err(_err) = rushee_connection.update_one(filter, update).await {
        return Ok(Json(json!({
            "status": "error",
            "message": "failed to persist assigned pis questions"
        })));
    }

    let questions: Vec<PISQuestion> = fixed_questions
        .into_iter()
        .chain(assigned_questions.into_iter())
        .collect();

    Ok(question_response(true, rushee.pis_timeslot, questions))
}

#[cfg(test)]
mod tests;
