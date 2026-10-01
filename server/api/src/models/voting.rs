use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub enum VoteOption {
    NotVoted,
    Yes,
    No,
    Abstain,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IncomingRusheeVote {
    pub brother_id: String, // gtid
    pub first_name: String,
    pub last_name: String,
    pub vote: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RusheeVote {
    pub brother_id: String, // gtid
    pub first_name: String,
    pub last_name: String,
    pub vote: VoteOption,
}
