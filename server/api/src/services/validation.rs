use std::{collections::HashSet, io::Error};

use bson::doc;

use crate::{
    models::{misc::RushNight, rushee::Comment},
    storage::db,
};

use crate::services::rush_time::same_day;

// These fields are duplicated in PIS signup, so edits must update both copies.
pub fn pis_signup_synced_fields() -> HashSet<String> {
    ["first_name", "last_name", "gtid"]
        .into_iter()
        .map(str::to_string)
        .collect()
}

// INVARIANT: only these profile fields may be changed by the rushee edit endpoint.
pub fn editable_rushee_fields() -> HashSet<String> {
    [
        "first_name",
        "last_name",
        "housing",
        "phone_number",
        "email",
        "gtid",
        "major",
        "class",
        "pronouns",
        "image_url",
    ]
    .into_iter()
    .map(str::to_string)
    .collect()
}

pub async fn is_gtid_valid(gtid: &str) -> Result<bool, Error> {
    // Preserve the existing byte-length rule before checking uniqueness.
    if gtid.len() != 9 {
        return Ok(false);
    }

    let connection = db::get_rushee_client().await;

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
