use once_cell::sync::Lazy;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::Mutex;

mod models;
mod queries;
pub use queries::{get_sorting_rushees, get_sorting_rushees_public};
mod notes;
pub use notes::{get_rushee_notes, update_rushee_notes};
mod mutations;
pub use mutations::{bulk_reorder, update_rushee_sorting};
mod move_rushee;
pub use move_rushee::move_rushee;

use models::{
    BulkReorderPayload, MoveRusheePayload, NotesPayload, SortingRushee, UpdateSortingPayload,
};

const SORTING_STATUSES: [&str; 6] = [
    "UNSORTED",
    "IN_CLOUD",
    "MID_CLOUD",
    "OUT_CLOUD",
    "DISCUSSED",
    "INELIGIBLE",
];

// Serialize sorting reorder updates to avoid interleaving writes.
static SORTING_REORDER_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));
static SORTING_COLUMN_LOCKS: Lazy<HashMap<String, Arc<Mutex<()>>>> = Lazy::new(|| {
    let mut map = HashMap::new();
    for status in SORTING_STATUSES.iter() {
        map.insert((*status).to_string(), Arc::new(Mutex::new(())));
    }
    map
});

fn validate_status(status: &str) -> bool {
    SORTING_STATUSES.iter().any(|s| s == &status)
}

#[cfg(test)]
mod tests;
