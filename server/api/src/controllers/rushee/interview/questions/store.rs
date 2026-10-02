use futures::stream::StreamExt;
use mongodb::bson::{doc, to_bson};
use mongodb::Collection;

use crate::models::pis::PISQuestion;
use crate::models::rushee::RusheeModel;
use crate::storage::db;

pub(super) async fn load_questions() -> Result<Vec<PISQuestion>, &'static str> {
    let connection = db::get_pis_questions_client().await;
    let mut cursor = connection
        .find(doc! {})
        .await
        .map_err(|_| "some error occurred while fetching pis questions")?;
    let mut questions = Vec::new();

    // Preserve partial reads: a malformed question is skipped rather than failing the request.
    while let Some(question) = cursor.next().await {
        if let Ok(question) = question {
            questions.push(question);
        }
    }

    Ok(questions)
}

pub(super) async fn save_assignment(
    connection: &Collection<RusheeModel>,
    id: &str,
    assigned_questions: &[PISQuestion],
) -> Result<(), &'static str> {
    let assigned_bson =
        to_bson(&assigned_questions).map_err(|_| "failed to serialize assigned pis questions")?;
    let filter = doc! {"gtid": id};
    let update = doc! { "$set": { "assigned_pis_questions": assigned_bson } };

    connection
        .update_one(filter, update)
        .await
        .map_err(|_| "failed to persist assigned pis questions")?;
    Ok(())
}
