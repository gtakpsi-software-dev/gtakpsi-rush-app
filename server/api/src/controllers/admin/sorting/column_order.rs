use crate::middlewares::auth::FirebaseUser;
use crate::models::rushee::RusheeModel;
use crate::storage::cursor_rows::for_each_valid_row;
use axum::http::StatusCode;
use mongodb::bson::{doc, DateTime};
use mongodb::Collection;

pub(super) async fn write_column_order(
    collection: &Collection<RusheeModel>,
    ids: &[String],
    column: &str,
    user: &FirebaseUser,
) -> mongodb::error::Result<()> {
    // Keep one write and timestamp per rushee; a failed update leaves earlier writes in place.
    for (idx, id_str) in ids.iter().enumerate() {
        let filter = doc! { "gtid": id_str };
        let update = doc! {
            "$set": {
                "sorting_status": column,
                "sorting_order": (idx as i32) + 1,
                "status_updated_at": DateTime::now(),
                "status_updated_by": user.email.clone().unwrap_or(user.uid.clone()),
            }
        };
        collection.update_one(filter, update).await?;
    }
    Ok(())
}

pub(super) async fn fetch_ids(
    collection: &Collection<RusheeModel>,
    column: &str,
) -> Result<Vec<String>, StatusCode> {
    let cursor = collection.find(doc! { "sorting_status": column }).await;
    match cursor {
        Ok(cursor) => {
            let mut items: Vec<(i32, String)> = Vec::new();
            for_each_valid_row(cursor, |doc| items.push((doc.sorting_order, doc.gtid))).await;
            // Tie-break by GTID so cursor order cannot change the visible board order.
            items.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.cmp(&b.1)));
            Ok(items.into_iter().map(|(_, id)| id).collect())
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}
