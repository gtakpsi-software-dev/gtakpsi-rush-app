use crate::middlewares::auth::FirebaseUser;
use crate::models::rushee::RusheeModel;
use axum::http::StatusCode;
use futures::stream::StreamExt;
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
        Ok(mut cursor) => {
            let mut items: Vec<(i32, String)> = Vec::new();
            while let Some(item) = cursor.next().await {
                if let Ok(doc) = item {
                    items.push((doc.sorting_order, doc.gtid));
                }
            }
            // Tie-break by GTID so cursor order cannot change the visible board order.
            items.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.cmp(&b.1)));
            Ok(items.into_iter().map(|(_, id)| id).collect())
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

fn insert_at_target(ids: &mut Vec<String>, id: String, target_index: i32) {
    // Keep negative indices at the front and oversized indices at the end of the column.
    let index = usize::try_from(target_index).unwrap_or(0).min(ids.len());
    ids.insert(index, id);
}

pub(super) fn move_within_column(
    mut ids: Vec<String>,
    moved_id: &str,
    target_index: i32,
) -> Option<Vec<String>> {
    let position = ids.iter().position(|id| id == moved_id)?;
    let id = ids.remove(position);
    insert_at_target(&mut ids, id, target_index);
    Some(ids)
}

pub(super) fn move_between_columns(
    mut source_ids: Vec<String>,
    mut target_ids: Vec<String>,
    moved_id: &str,
    target_index: i32,
) -> Option<(Vec<String>, Vec<String>)> {
    let position = source_ids.iter().position(|id| id == moved_id)?;
    let id = source_ids.remove(position);
    insert_at_target(&mut target_ids, id, target_index);
    Some((source_ids, target_ids))
}

#[cfg(test)]
mod tests {
    use super::{move_between_columns, move_within_column};

    fn ids(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| (*value).to_string()).collect()
    }

    #[test]
    fn moving_within_a_column_uses_the_order_after_removal() {
        assert_eq!(
            move_within_column(ids(&["a", "b", "c"]), "a", 2),
            Some(ids(&["b", "c", "a"]))
        );
        assert_eq!(
            move_within_column(ids(&["a", "b", "c"]), "c", -1),
            Some(ids(&["c", "a", "b"]))
        );
        assert_eq!(
            move_within_column(ids(&["a", "b", "c"]), "b", i32::MAX),
            Some(ids(&["a", "c", "b"]))
        );
    }

    #[test]
    fn moving_between_columns_keeps_source_and_target_order() {
        assert_eq!(
            move_between_columns(ids(&["a", "b", "c"]), ids(&["x", "y"]), "b", 1),
            Some((ids(&["a", "c"]), ids(&["x", "b", "y"])))
        );
        assert_eq!(
            move_between_columns(ids(&["a", "b"]), ids(&[]), "a", -1),
            Some((ids(&["b"]), ids(&["a"])))
        );
    }

    #[test]
    fn missing_rushee_does_not_produce_an_order_to_write() {
        assert_eq!(move_within_column(ids(&["a"]), "missing", 0), None);
        assert_eq!(
            move_between_columns(ids(&["a"]), ids(&["x"]), "missing", 0),
            None
        );
    }
}
