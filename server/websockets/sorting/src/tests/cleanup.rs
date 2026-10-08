use super::*;
use crate::state::DragState;
use std::time::{Duration, Instant};

// Builds a drag fixture with a chosen last-update time.
fn drag(id: &str, last_update: Instant) -> DragState {
    DragState {
        dragger_id: "owner".to_string(),
        dragger_name: "Test Admin".to_string(),
        rushee_id: id.to_string(),
        rushee_name: "Test Rushee".to_string(),
        position_x: 1.0,
        position_y: 2.0,
        last_update,
    }
}

// Checks the cleanup interval and ensures recent drags remain active.
#[tokio::test(start_paused = true)]
async fn cleanup_waits_for_its_interval_and_releases_only_stale_drags() {
    let (state, mut broadcasts) = state();
    let now = Instant::now();
    {
        let mut drags = state.drag_state.write().await;
        drags.insert("fresh".to_string(), drag("fresh", now));
        drags.insert(
            "old-a".to_string(),
            drag("old-a", now - Duration::from_secs(61)),
        );
        drags.insert(
            "old-b".to_string(),
            drag("old-b", now - Duration::from_secs(120)),
        );
    }

    // Tokio's paused clock removes wall-clock waits; backdated std::Instant values control drag age.
    let task = tokio::spawn(crate::cleanup::run(state.clone()));
    tokio::task::yield_now().await;
    tokio::time::advance(Duration::from_secs(9)).await;
    tokio::task::yield_now().await;
    assert_empty(&mut broadcasts);
    assert_eq!(state.drag_state.read().await.len(), 3);

    tokio::time::advance(Duration::from_secs(1)).await;
    tokio::task::yield_now().await;
    let events = [receive(&mut broadcasts), receive(&mut broadcasts)];
    assert!(events.contains(&json!({"type": "drag_end", "rushee_id": "old-a"})));
    assert!(events.contains(&json!({"type": "drag_end", "rushee_id": "old-b"})));
    assert_empty(&mut broadcasts);
    let drags = state.drag_state.read().await;
    assert_eq!(drags.len(), 1);
    assert_eq!(drags["fresh"].position_x, 1.0);
    drop(drags);

    tokio::time::advance(Duration::from_secs(10)).await;
    tokio::task::yield_now().await;
    assert_empty(&mut broadcasts);
    task.abort();
}
