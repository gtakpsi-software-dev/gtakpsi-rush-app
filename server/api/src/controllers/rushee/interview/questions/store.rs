use mongodb::bson::{doc, to_bson};
use mongodb::Collection;

use crate::models::pis::PISQuestion;
use crate::models::rushee::RusheeModel;
use crate::storage::{cursor_rows::collect_valid_rows, db};

pub(super) async fn load_questions() -> Result<Vec<PISQuestion>, &'static str> {
    let connection = db::get_pis_questions_collection().await;
    let cursor = connection
        .find(doc! {})
        .await
        .map_err(|_| "some error occurred while fetching pis questions")?;
    Ok(collect_valid_rows(cursor).await)
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
