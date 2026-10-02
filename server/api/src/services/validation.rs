use std::io::Error;

use bson::doc;

use crate::{
    models::{rush_nights::RushNight, rushee::Comment},
    storage::db,
};

use crate::services::rush_time::same_day;

// These fields are duplicated in PIS signup, so edits must update both copies.
pub fn is_pis_signup_synced_field(field: &str) -> bool {
    matches!(field, "first_name" | "last_name" | "gtid")
}

// INVARIANT: only these profile fields may be changed by the rushee edit endpoint.
pub fn is_editable_rushee_field(field: &str) -> bool {
    matches!(
        field,
        "first_name"
            | "last_name"
            | "housing"
            | "phone_number"
            | "email"
            | "gtid"
            | "major"
            | "class"
            | "pronouns"
            | "image_url"
    )
}

pub async fn is_gtid_valid(gtid: &str) -> Result<bool, Error> {
    // Preserve the existing byte-length rule before checking uniqueness.
    if gtid.len() != 9 {
        return Ok(false);
    }

    let connection = db::get_rushee_collection().await;

    match connection.find_one(doc! {"gtid": gtid}).await {
        Ok(Some(_)) => Ok(false),
        Ok(None) => Ok(true),
        Err(_) => Err(Error::other("couldn't verify gtid")),
    }
}

pub async fn check_valid_comment(
    brother_name: &str,
    night: &RushNight,
    comments: &[Comment],
) -> Result<bool, Error> {
    // Reject a second comment from the same brother on the same rush-calendar day.
    if comments.iter().any(|comment| {
        comment.brother_name == brother_name && same_day(&comment.night.time, &night.time)
    }) {
        Err(Error::other("already made a comment"))
    } else {
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::{is_editable_rushee_field, is_pis_signup_synced_field};

    #[test]
    fn profile_edit_fields_keep_exact_allowlists() {
        for field in ["first_name", "last_name", "gtid"] {
            assert!(is_pis_signup_synced_field(field));
            assert!(is_editable_rushee_field(field));
        }

        for field in [
            "housing",
            "phone_number",
            "email",
            "major",
            "class",
            "pronouns",
            "image_url",
        ] {
            assert!(!is_pis_signup_synced_field(field));
            assert!(is_editable_rushee_field(field));
        }

        for field in ["", "First_name", "first_name ", "access_code", "pis_signup"] {
            assert!(!is_pis_signup_synced_field(field));
            assert!(!is_editable_rushee_field(field));
        }
    }
}
