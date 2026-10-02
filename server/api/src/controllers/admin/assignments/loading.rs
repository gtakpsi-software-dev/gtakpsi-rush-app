use futures::{Stream, StreamExt};
use mongodb::{bson::doc, Collection};

use crate::models::pis::BrotherPISAvailability;
use crate::models::rushee::RusheeModel;
use crate::storage::db;

pub(super) async fn load_brother_availabilities() -> Result<Vec<BrotherPISAvailability>, ()> {
    let collection = db::get_brother_pis_availability_client().await;
    let cursor = collection.find(doc! {}).await.map_err(|_| ())?;
    Ok(collect_valid(cursor).await)
}

pub(super) async fn load_rushees(
    collection: &Collection<RusheeModel>,
) -> Result<Vec<RusheeModel>, ()> {
    let cursor = collection.find(doc! {}).await.map_err(|_| ())?;
    Ok(collect_valid(cursor).await)
}

async fn collect_valid<T, E>(mut cursor: impl Stream<Item = Result<T, E>> + Unpin) -> Vec<T> {
    let mut items = Vec::new();
    // Preserve the existing assignment contract: a malformed row does not
    // abort the run or prevent later valid rows from being considered.
    while let Some(item) = cursor.next().await {
        if let Ok(value) = item {
            items.push(value);
        }
    }
    items
}

#[cfg(test)]
mod tests {
    use super::collect_valid;
    use futures::stream;

    #[tokio::test]
    async fn malformed_rows_do_not_hide_later_valid_rows() {
        let cursor = stream::iter([Ok(1), Err(()), Ok(2)]);
        assert_eq!(collect_valid(cursor).await, vec![1, 2]);
    }
}
