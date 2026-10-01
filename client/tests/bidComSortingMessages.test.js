import assert from "node:assert/strict";
import test from "node:test";

import { handleBidComSortingMessage } from "../src/features/sorting/handleBidComSortingMessage.js";

function harness() {
    const calls = [];
    const state = { viewerCount: null, ghostCards: {} };
    const ghostTimestampsRef = { current: {} };
    const fetchDataRef = { current: () => calls.push("fetch") };
    const deps = {
        ghostTimestampsRef,
        fetchDataRef,
        setViewerCount: (count) => { calls.push("viewers"); state.viewerCount = count; },
        setGhostCards: (update) => { calls.push("ghosts"); state.ghostCards = update(state.ghostCards); },
        now: () => { calls.push("now"); return 12345; },
    };
    return { calls, state, ghostTimestampsRef, fetchDataRef, deps };
}

const drag = {
    rushee_id: "r1", rushee_name: "Private Name", x: 10, y: 20,
    dragger_name: "Admin",
};

test("viewer count and drag start retain updates while redacting the rushee name", () => {
    const { calls, state, ghostTimestampsRef, deps } = harness();
    handleBidComSortingMessage({ type: "viewer_count", count: 4 }, deps);
    handleBidComSortingMessage({ type: "drag_start", ...drag }, deps);
    assert.equal(state.viewerCount, 4);
    assert.deepEqual(ghostTimestampsRef.current, { r1: 12345 });
    assert.deepEqual(state.ghostCards, {
        r1: { rusheeId: "r1", rusheeName: "Rushee", x: 10, y: 20, draggerName: "Admin" },
    });
    assert.deepEqual(calls, ["viewers", "now", "ghosts"]);
});

test("drag movement refreshes timestamps even when its ghost has not arrived", () => {
    const { calls, state, ghostTimestampsRef, deps } = harness();
    const originalGhosts = state.ghostCards;
    handleBidComSortingMessage({ type: "drag_move", rushee_id: "r1", x: 30, y: 40 }, deps);
    assert.equal(state.ghostCards, originalGhosts);
    assert.equal(ghostTimestampsRef.current.r1, 12345);
    assert.deepEqual(calls, ["now", "ghosts"]);

    handleBidComSortingMessage({ type: "drag_start", ...drag }, deps);
    handleBidComSortingMessage({ type: "drag_move", rushee_id: "r1", x: 30, y: 40 }, deps);
    assert.deepEqual(state.ghostCards.r1, {
        rusheeId: "r1", rusheeName: "Rushee", x: 30, y: 40, draggerName: "Admin",
    });
});

test("drag end clears the ghost and timestamp but missing ghosts keep state identity", () => {
    const { state, ghostTimestampsRef, deps } = harness();
    handleBidComSortingMessage({ type: "drag_start", ...drag }, deps);
    handleBidComSortingMessage({ type: "drag_end", rushee_id: "r1" }, deps);
    assert.deepEqual(state.ghostCards, {});
    assert.deepEqual(ghostTimestampsRef.current, {});

    const currentGhosts = state.ghostCards;
    handleBidComSortingMessage({ type: "drag_end", rushee_id: "missing" }, deps);
    assert.equal(state.ghostCards, currentGhosts);
});

test("card movement clears its stale ghost and refreshes even without an ID", () => {
    const { calls, state, ghostTimestampsRef, deps } = harness();
    handleBidComSortingMessage({ type: "drag_start", ...drag }, deps);
    handleBidComSortingMessage({ type: "card_moved", rushee_id: "r1" }, deps);
    assert.deepEqual(state.ghostCards, {});
    assert.deepEqual(ghostTimestampsRef.current, {});
    assert.deepEqual(calls.slice(-2), ["ghosts", "fetch"]);

    const ghosts = state.ghostCards;
    handleBidComSortingMessage({ type: "card_moved" }, deps);
    assert.equal(state.ghostCards, ghosts);
    assert.deepEqual(calls.slice(-1), ["fetch"]);
});

test("current active drag is redacted; inactive and unknown messages have no effect", () => {
    const { calls, state, ghostTimestampsRef, deps } = harness();
    handleBidComSortingMessage({ type: "current_drag", active: false, ...drag }, deps);
    handleBidComSortingMessage({ type: "unknown", ...drag }, deps);
    assert.deepEqual(calls, []);

    handleBidComSortingMessage({ type: "current_drag", active: true, ...drag }, deps);
    assert.equal(ghostTimestampsRef.current.r1, 12345);
    assert.deepEqual(state.ghostCards.r1, {
        rusheeId: "r1", rusheeName: "Rushee", x: 10, y: 20, draggerName: "Admin",
    });
});
