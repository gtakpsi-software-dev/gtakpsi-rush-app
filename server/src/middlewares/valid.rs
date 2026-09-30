/**
 * Contains a bunch of functions to check if something is valid or not
 */

use std::{collections::HashSet, io::Error};

use bson::doc;

use crate::{controllers::db, models::{misc::RushNight, rushee::Comment}};

use super::time_helpers::same_day;

/**
 * Changes we have to handle specially
 */
pub fn get_pis_signup_breaking_changes() -> HashSet<String> {

    let mut result = HashSet::<String>::new();

    result.insert("first_name".to_string());
    result.insert("last_name".to_string());
    result.insert("gtid".to_string());

    return result;

}

/**
 * General edits to the rushee
 */
pub fn get_rushee_edit_fields() -> HashSet<String> {

    let mut result = HashSet::<String>::new();

    result.insert("first_name".to_string());
    result.insert("last_name".to_string());
    result.insert("housing".to_string());
    result.insert("phone_number".to_string());
    result.insert("email".to_string());
    result.insert("gtid".to_string());
    result.insert("major".to_string());
    result.insert("class".to_string());
    result.insert("pronouns".to_string());
    result.insert("image_url".to_string());

    return result;

}

pub async fn is_gtid_valid(gtid: &str) -> Result<bool, Error> {

    if gtid.len() != 9 {
        return Ok(false);
    }

    let connection = db::get_rushee_client().await;

    let filter = doc! {"gtid": gtid};
    let result = connection.find_one(filter).await;

    match result {

        Ok(find_result) => {

            match find_result {

                Some(_x) => {
                    return Ok(false);
                }
                None => {
                    return Ok(true);
                }

            }

        }

        Err(_err) => {

            return Err(Error::new(std::io::ErrorKind::Other, "couldn't verify gtid"));

        }

    }

}

pub async fn check_valid_comment(brother_name: &str, night: &RushNight, comments: &Vec<Comment>) -> Result<bool, Error> {

    let result = comments.iter()
    .find(|comment| comment.brother_name == brother_name && same_day(&comment.night.time, &night.time));

    match result {

        Some(x) => {
            return Err(Error::new(std::io::ErrorKind::Other, "already made a comment"))
        }

        None => {
            return Ok(true)
        }

    }

}