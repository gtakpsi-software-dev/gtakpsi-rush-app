use super::average_rating_value;
use crate::models::rushee::Comment;
use crate::services::rush_time::same_day;
use mongodb::bson::{doc, Document};
use std::collections::HashSet;

pub(super) fn rating_recalculations_after_deletion(
    comments: Vec<Comment>,
    deleted: &Comment,
) -> Vec<(String, Option<f32>)> {
    // Preserve the existing same-day calculation, even though MongoDB pulls
    // the stored comment by its full night value.
    let remaining_comments: Vec<Comment> = comments
        .into_iter()
        .filter(|comment| {
            !(comment.brother_name == deleted.brother_name
                && same_day(&comment.night.time, &deleted.night.time))
        })
        .collect();

    // Only categories present on the deleted comment are updated in storage.
    let mut rating_categories = HashSet::new();
    for rating in &deleted.ratings {
        rating_categories.insert(rating.name.clone());
    }

    rating_categories
        .into_iter()
        .map(|category| {
            let value = average_rating_value(&remaining_comments, &category, None);
            (category, value)
        })
        .collect()
}

pub(super) fn rating_update_for_deletion(
    id: &str,
    category: &str,
    value: Option<f32>,
) -> (Document, Document, &'static str) {
    match value {
        Some(value) => (
            doc! { "gtid": id, "ratings.name": category },
            doc! { "$set": { "ratings.$.value": value } },
            "error updating ratings after comment deletion",
        ),
        None => (
            doc! { "gtid": id },
            doc! { "$pull": { "ratings": { "name": category } } },
            "error removing rating category after comment deletion",
        ),
    }
}
