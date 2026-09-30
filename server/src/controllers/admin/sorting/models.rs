use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct SortingRushee {
    pub id: String,
    pub fullName: String,
    pub rushNumber: i32,
    pub sortingStatus: String,
    pub sortingOrder: i32,
    pub sortingTags: Vec<String>,
}

#[derive(Deserialize)]
pub struct UpdateSortingPayload {
    pub sortingStatus: String,
    pub sortingOrder: i32,
}

#[derive(Deserialize)]
pub struct BulkReorderPayload {
    pub column: String,
    pub orderedRusheeIds: Vec<String>,
}

#[derive(Deserialize)]
pub struct MoveRusheePayload {
    pub fromColumn: String,
    pub toColumn: String,
    pub movedRusheeId: String,
    pub targetIndex: i32,
}

#[derive(Deserialize)]
pub struct NotesPayload {
    pub sortingNotes: String,
    #[serde(default)]
    pub sortingTags: Vec<String>,
}
