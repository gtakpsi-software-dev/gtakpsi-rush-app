use super::average_rating_value;
use crate::models::rushee::{Rating, RusheeModel};
use mongodb::bson::{doc, Document};

pub(crate) fn build_rating_update(
    id: &str,
    rating: &Rating,
    value: f32,
    exists: bool,
) -> (Document, Document) {
    if exists {
        (
            doc! { "gtid": id, "ratings.name": rating.name.clone() },
            doc! { "$set": { "ratings.$.value": value } },
        )
    } else {
        (
            doc! { "gtid": id },
            doc! { "$push": { "ratings": { "name": rating.name.clone(), "value": value } } },
        )
    }
}

pub(crate) async fn update_global_ratings(
    connection: &mongodb::Collection<RusheeModel>,
    id: &str,
    rushee: &RusheeModel,
    ratings: &[Rating],
) -> Result<(), mongodb::error::Error> {
    // Keep sequential writes and the original rushee snapshot: a later failure
    // must leave earlier rating updates in place, including duplicate categories.
    for rating in ratings {
        let value =
            average_rating_value(&rushee.comments, &rating.name, Some(rating.value)).unwrap_or(0.0);
        let exists = rushee
            .ratings
            .iter()
            .any(|existing| existing.name == rating.name);
        let (filter, update) = build_rating_update(id, rating, value, exists);
        connection.update_one(filter, update).await?;
    }

    Ok(())
}
