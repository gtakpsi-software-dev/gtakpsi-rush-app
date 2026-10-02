use bson::DateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct RushNight {
    pub time: DateTime,
    pub name: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct IncomingRushNight {
    pub time: String,
    pub name: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct IncomingBrotherName {
    pub first_name: String,
    pub last_name: String,
}
