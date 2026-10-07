mod deletion_plan;
mod rating_updates;

pub(crate) use deletion_plan::{rating_recalculations_after_deletion, rating_update_for_deletion};
pub(crate) use rating_updates::update_global_ratings;

use crate::models::rushee::Comment;

/// Only 1–5 values contribute to averages; legacy zero ratings remain on comments.
fn is_modern_rating_value(value: f32) -> bool {
    (1.0..=5.0).contains(&value)
}

/// Excludes legacy and out-of-range ratings. A new value follows stored comments
/// so creation and deletion use the same floating-point accumulation order.
fn average_rating_value(
    comments: &[Comment],
    category: &str,
    new_value: Option<f32>,
) -> Option<f32> {
    let mut values = Vec::new();

    for comment in comments {
        if let Some(rating) = comment
            .ratings
            .iter()
            .find(|rating| rating.name == category)
        {
            if is_modern_rating_value(rating.value) {
                values.push(rating.value);
            }
        }
    }

    if let Some(value) = new_value {
        if is_modern_rating_value(value) {
            values.push(value);
        }
    }

    if values.is_empty() {
        None
    } else {
        Some(values.iter().sum::<f32>() / values.len() as f32)
    }
}

#[cfg(test)]
mod tests;
