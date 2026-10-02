use crate::{models::rushee::RusheeModel, storage::db};
use mongodb::bson::doc;
use std::fmt;

#[derive(Debug)]
pub struct RusheeError {
    pub code: String,
    pub message: String,
}

impl fmt::Display for RusheeError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for RusheeError {}

pub async fn fetch_rushee(gtid: String) -> Result<RusheeModel, RusheeError> {
    let connection = db::get_rushee_client().await;

    let filter = doc! {"gtid": gtid};
    let result = connection.find_one(filter).await;

    match result {
        Ok(Some(rushee)) => Ok(rushee),
        Ok(None) => Err(RusheeError {
            code: "RUSHEE_NOT_FOUND".to_string(),
            message: "No rushee found with that ID".to_string(),
        }),
        Err(e) => Err(RusheeError {
            code: "DATABASE_ERROR".to_string(),
            message: format!("Database error: {e}"),
        }),
    }
}
