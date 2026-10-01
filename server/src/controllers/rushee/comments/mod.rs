mod create;
pub use create::post_comment;

mod delete;
pub use delete::delete_comment;

mod edit;
pub use edit::edit_comment;

mod queries;
pub use queries::get_brother_comments;

mod rating_updates;

use crate::models::rushee::Comment;

/// Only 1–5 values contribute to averages; legacy zero ratings remain on comments.
fn is_modern_rating_value(value: f32) -> bool {
    value >= 1.0 && value <= 5.0
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
