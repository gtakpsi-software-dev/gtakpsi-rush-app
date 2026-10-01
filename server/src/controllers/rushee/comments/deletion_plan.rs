use super::average_rating_value;
use crate::middlewares::time_helpers::same_day;
use crate::models::rushee::Comment;
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
