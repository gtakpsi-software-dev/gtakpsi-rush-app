import assert from "node:assert/strict";
import test from "node:test";

import { handleSortingViewerMessage } from "../../../src/features/sorting/handleSortingViewerMessage.js";

// Create isolated state, dependency fakes, and captured calls for this test.
function harness() {
    const calls = [];
    const state = { viewerCount: null, ghostCards: {} };
    const ghostTimestampsRef = { current: {} };
    const fetchDataRef = { current: /* Record current calls for assertions. */ () => calls.push("fetch") };
    const deps = {
        ghostTimestampsRef,
        fetchDataRef,
        // Record viewer-count updates and store the latest count.
        setViewerCount: (count) => { calls.push("viewers"); state.viewerCount = count; },
        // Apply and record ghost-card updates.
        setGhostCards: (update) => { calls.push("ghosts"); state.ghostCards = update(state.ghostCards); },
        // Record clock reads and return a fixed timestamp.
        now: () => { calls.push("now"); return 12345; },
    };
    return { calls, state, ghostTimestampsRef, fetchDataRef, deps };
}

const drag = {
    rushee_id: "r1", rushee_name: "Private Name", x: 10, y: 20,
    dragger_name: "Admin",
};

test("viewer count and drag start retain updates while redacting the rushee name", () => {
    // Verify viewer count and drag start retain updates while redacting the rushee name.
    const { calls, state, ghostTimestampsRef, deps } = harness();
    handleSortingViewerMessage({ type: "viewer_count", count: 4 }, deps);
    handleSortingViewerMessage({ type: "drag_start", ...drag }, deps);
    assert.equal(state.viewerCount, 4);
    assert.deepEqual(ghostTimestampsRef.current, { r1: 12345 });
    assert.deepEqual(state.ghostCards, {
        r1: { rusheeId: "r1", rusheeName: "Rushee", x: 10, y: 20, draggerName: "Admin" },
    });
    assert.deepEqual(calls, ["viewers", "now", "ghosts"]);
});

test("drag movement refreshes timestamps even when its ghost has not arrived", () => {
    // Verify drag movement refreshes timestamps even when its ghost has not arrived.
    const { calls, state, ghostTimestampsRef, deps } = harness();
    const originalGhosts = state.ghostCards;
    handleSortingViewerMessage({ type: "drag_move", rushee_id: "r1", x: 30, y: 40 }, deps);
    assert.equal(state.ghostCards, originalGhosts);
    assert.equal(ghostTimestampsRef.current.r1, 12345);
    assert.deepEqual(calls, ["now", "ghosts"]);

    handleSortingViewerMessage({ type: "drag_start", ...drag }, deps);
    handleSortingViewerMessage({ type: "drag_move", rushee_id: "r1", x: 30, y: 40 }, deps);
    assert.deepEqual(state.ghostCards.r1, {
        rusheeId: "r1", rusheeName: "Rushee", x: 30, y: 40, draggerName: "Admin",
    });
});

test("drag end clears the ghost and timestamp but missing ghosts keep state identity", () => {
    // Verify drag end clears the ghost and timestamp but missing ghosts keep state identity.
    const { state, ghostTimestampsRef, deps } = harness();
    handleSortingViewerMessage({ type: "drag_start", ...drag }, deps);
    handleSortingViewerMessage({ type: "drag_end", rushee_id: "r1" }, deps);
    assert.deepEqual(state.ghostCards, {});
    assert.deepEqual(ghostTimestampsRef.current, {});

    const currentGhosts = state.ghostCards;
    handleSortingViewerMessage({ type: "drag_end", rushee_id: "missing" }, deps);
    assert.equal(state.ghostCards, currentGhosts);
});

test("card movement clears its stale ghost and refreshes even without an ID", () => {
    // Verify card movement clears its stale ghost and refreshes even without an ID.
    const { calls, state, ghostTimestampsRef, deps } = harness();
    handleSortingViewerMessage({ type: "drag_start", ...drag }, deps);
    handleSortingViewerMessage({ type: "card_moved", rushee_id: "r1" }, deps);
    assert.deepEqual(state.ghostCards, {});
    assert.deepEqual(ghostTimestampsRef.current, {});
    assert.deepEqual(calls.slice(-2), ["ghosts", "fetch"]);

    const ghosts = state.ghostCards;
    handleSortingViewerMessage({ type: "card_moved" }, deps);
    assert.equal(state.ghostCards, ghosts);
    assert.deepEqual(calls.slice(-1), ["fetch"]);
});

test("current active drag is redacted; inactive and unknown messages have no effect", () => {
    // Verify current active drag is redacted; inactive and unknown messages have no effect.
    const { calls, state, ghostTimestampsRef, deps } = harness();
    handleSortingViewerMessage({ type: "current_drag", active: false, ...drag }, deps);
    handleSortingViewerMessage({ type: "unknown", ...drag }, deps);
    assert.deepEqual(calls, []);

    handleSortingViewerMessage({ type: "current_drag", active: true, ...drag }, deps);
    assert.equal(ghostTimestampsRef.current.r1, 12345);
    assert.deepEqual(state.ghostCards.r1, {
        rusheeId: "r1", rusheeName: "Rushee", x: 10, y: 20, draggerName: "Admin",
    });
});

test("inactive current drag leaves an existing viewer ghost untouched", () => {
    // Verify inactive current drag leaves an existing viewer ghost untouched.
    const { calls, state, ghostTimestampsRef, deps } = harness();
    handleSortingViewerMessage({ type: "drag_start", ...drag }, deps);
    const ghosts = state.ghostCards;
    const timestamp = ghostTimestampsRef.current.r1;
    calls.length = 0;

    handleSortingViewerMessage({ type: "current_drag", active: false, ...drag }, deps);
    assert.equal(state.ghostCards, ghosts);
    assert.equal(ghostTimestampsRef.current.r1, timestamp);
    assert.deepEqual(calls, []);
});

test("brother viewers retain the message-supplied rushee name for both drag events", () => {
    // Verify brother viewers retain the message-supplied rushee name for both drag events.
    const { state, deps } = harness();
    handleSortingViewerMessage({ type: "drag_start", ...drag }, {
        ...deps, showRusheeNames: true,
    });
    assert.equal(state.ghostCards.r1.rusheeName, "Private Name");
    handleSortingViewerMessage({ type: "current_drag", active: true, ...drag }, {
        ...deps, showRusheeNames: true,
    });
    assert.equal(state.ghostCards.r1.rusheeName, "Private Name");
});
