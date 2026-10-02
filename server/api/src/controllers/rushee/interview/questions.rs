use crate::models::pis::PISQuestion;
use crate::storage::db;
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::doc;
use serde_json::{json, Value};

use crate::services::pis_question_selection::{category_buckets, draw_one_per_bucket};
mod store;
use self::store::{load_questions, save_assignment};

/// How long before a rushee's PIS timeslot their randomized bucket
/// questions become visible/get assigned.
const PIS_QUESTION_REVEAL_LEAD_MINUTES: i64 = 10;

fn sort_pis_questions(questions: &mut [PISQuestion]) {
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

/// Returns fixed PIS questions before reveal and the persisted one-per-category
/// selection afterward. Later requests reuse that selection.
pub async fn get_pis_interview_questions(
    Path(id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let rushee_connection = db::get_rushee_collection().await;

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

    let all_questions = match load_questions().await {
        Ok(questions) => questions,
        Err(message) => {
            return Ok(Json(json!({
                "status": "error",
                "message": message
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

    // Reuse the persisted selection so later requests do not redraw category questions.
    if let Some(assigned) = rushee.assigned_pis_questions {
        if !assigned.is_empty() {
            let questions: Vec<PISQuestion> = fixed_questions
                .into_iter()
                .chain(assigned.into_iter())
                .collect();
            return Ok(question_response(true, rushee.pis_timeslot, questions));
        }
    }

    let by_category = category_buckets(all_questions);

    // Scoped so the (non-Send) ThreadRng is dropped before any `.await` below.
    let assigned_questions: Vec<PISQuestion> = {
        let mut rng = rand::thread_rng();
        draw_one_per_bucket(by_category, &mut rng)
    };

    if let Err(message) = save_assignment(&rushee_connection, &id, &assigned_questions).await {
        return Ok(Json(json!({
            "status": "error",
            "message": message
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
