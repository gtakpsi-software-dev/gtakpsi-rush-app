use super::*;

#[tokio::test]
async fn only_the_owner_can_move_and_end_a_drag_even_after_role_changes() {
    let (state, mut broadcasts) = state();
    add_client(&state, "owner");
    add_client(&state, "other");
    join_admin(&state, "owner", None).await;
    join_admin(&state, "other", Some("Other Admin")).await;
    start_drag(&state, "owner", "card").await;
    assert_eq!(
        receive(&mut broadcasts),
        json!({"type": "drag_start", "dragger_name": "Admin", "rushee_id": "card", "rushee_name": "Test Rushee", "x": 10.5, "y": -2.0})
    );

    for message in [
        json!({"type": "drag_move", "rushee_id": "card", "x": 99.0, "y": 50.0}),
        json!({"type": "drag_end", "rushee_id": "card"}),
    ] {
        send(&state, "other", message).await;
    }
    assert_empty(&mut broadcasts);
    assert_eq!(state.drag_state.read().await["card"].position_x, 10.5);

    send(&state, "owner", json!({"type": "join", "is_admin": false})).await;
    send(
        &state,
        "owner",
        json!({"type": "drag_move", "rushee_id": "card", "x": 0.25, "y": 100.0}),
    )
    .await;
    assert_eq!(
        receive(&mut broadcasts),
        json!({"type": "drag_move", "rushee_id": "card", "x": 0.25, "y": 100.0})
    );
    assert_eq!(state.drag_state.read().await["card"].position_y, 100.0);
    send(
        &state,
        "owner",
        json!({"type": "drag_end", "rushee_id": "card"}),
    )
    .await;
    assert_eq!(
        receive(&mut broadcasts),
        json!({"type": "drag_end", "rushee_id": "card"})
    );
    assert!(state.drag_state.read().await.is_empty());
    send(
        &state,
        "owner",
        json!({"type": "drag_end", "rushee_id": "card"}),
    )
    .await;
    assert_empty(&mut broadcasts);
}

#[tokio::test]
async fn conflicting_drag_is_denied_only_to_requester_and_same_owner_can_restart() {
    let (state, mut broadcasts) = state();
    let mut owner_messages = add_client(&state, "owner");
    let mut other_messages = add_client(&state, "other");
    join_admin(&state, "owner", Some("Test Admin")).await;
    join_admin(&state, "other", Some("Other Admin")).await;
    start_drag(&state, "owner", "card").await;
    receive(&mut broadcasts);
    start_drag(&state, "other", "card").await;

    assert_eq!(
        receive(&mut other_messages),
        json!({"type": "drag_denied", "rushee_id": "card", "dragger_name": "Test Admin"})
    );
    assert_empty(&mut owner_messages);
    assert_empty(&mut broadcasts);
    assert_eq!(state.drag_state.read().await["card"].dragger_id, "owner");

    start_drag(&state, "owner", "card").await;
    assert_eq!(receive(&mut broadcasts)["type"], "drag_start");
    start_drag(&state, "other", "second-card").await;
    assert_eq!(receive(&mut broadcasts)["rushee_id"], "second-card");
    assert_eq!(state.drag_state.read().await.len(), 2);
}
