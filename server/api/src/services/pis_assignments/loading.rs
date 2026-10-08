use mongodb::{bson::doc, Collection};

use crate::models::pis::BrotherPISAvailability;
use crate::models::rushee::RusheeModel;
use crate::storage::{cursor_rows::collect_valid_rows, db};

// Load brother availability records, skipping rows that cannot be decoded.
pub(crate) async fn load_brother_availabilities() -> Result<Vec<BrotherPISAvailability>, ()> {
    let collection = db::get_brother_pis_availability_collection().await;
    let cursor = collection.find(doc! {}).await.map_err(|_| ())?;
    Ok(collect_valid_rows(cursor).await)
}

// Load rushees for assignment planning, skipping rows that cannot be decoded.
pub(crate) async fn load_rushees(
    collection: &Collection<RusheeModel>,
) -> Result<Vec<RusheeModel>, ()> {
    let cursor = collection.find(doc! {}).await.map_err(|_| ())?;
    Ok(collect_valid_rows(cursor).await)
}
