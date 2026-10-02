use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
pub struct IncomingBrotherName {
    pub first_name: String,
    pub last_name: String,
}
