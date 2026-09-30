mod create;
pub use create::post_comment;

mod delete;
pub use delete::delete_comment;

mod edit;
pub use edit::edit_comment;

mod queries;
pub use queries::get_brother_comments;

/// Only 1–5 values contribute to averages; legacy zero ratings remain on comments.
fn is_modern_rating_value(value: f32) -> bool {
    value >= 1.0 && value <= 5.0
}

#[cfg(test)]
mod tests;
