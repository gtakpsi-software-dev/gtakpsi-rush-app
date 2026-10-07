use serde::{Deserialize, Serialize};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SortingRushee {
    pub id: String,
    pub full_name: String,
    pub rush_number: i32,
    pub sorting_status: String,
    pub sorting_order: i32,
    pub sorting_tags: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSortingPayload {
    pub sorting_status: String,
    pub sorting_order: i32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkReorderPayload {
    pub column: String,
    pub ordered_rushee_ids: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveRusheePayload {
    pub from_column: String,
    pub to_column: String,
    pub moved_rushee_id: String,
    pub target_index: i32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotesPayload {
    pub sorting_notes: String,
    #[serde(default)]
    pub sorting_tags: Vec<String>,
}
