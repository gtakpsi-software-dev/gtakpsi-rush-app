import assert from "node:assert/strict";
import test from "node:test";

import { handleAdminSortingMessage } from "../../../src/features/sorting/handleAdminSortingMessage.js";

// Create isolated state, dependency fakes, and captured calls for this test.
function harness(overrides = {}) {
    const calls = [];
    const state = { viewerCount: null, ghostCards: {}, lockedCards: {} };
    const refs = {
        draggingRef: { current: null },
        ghostTimestampsRef: { current: {} },
        fetchDataRef: { current: /* Record current calls for assertions. */ () => calls.push("fetch") },
    };
    const dependencies = {
        ...refs,
        // Record viewer-count updates and store the latest count.
        setViewerCount: (count) => { calls.push("viewers"); state.viewerCount = count; },
        // Apply and record ghost-card updates.
        setGhostCards: (update) => { calls.push("ghosts"); state.ghostCards = update(state.ghostCards); },
        // Apply and record card-lock updates.
        setLockedCards: (update) => { calls.push("locks"); state.lockedCards = update(state.lockedCards); },
        // Record cancel drag state calls for assertions.
        cancelDragState: () => calls.push("cancel"),
        // Record clock reads and return a fixed timestamp.
        now: () => { calls.push("now"); return 12345; },
        ...overrides,
    };
    return { calls, state, refs, dependencies };
}

const remoteDrag = {
    rushee_id: "r1", rushee_name: "Ada One", x: 10, y: 20,
    dragger_name: "Other Admin",
};

test("viewer counts and remote drag starts retain update order and ghost fields", () => {
    // Verify viewer counts and remote drag starts retain update order and ghost fields.
    const { calls, state, refs, dependencies } = harness();
    handleAdminSortingMessage({ type: "viewer_count", count: 4 }, dependencies);
    handleAdminSortingMessage({ type: "drag_start", ...remoteDrag }, dependencies);
    assert.equal(state.viewerCount, 4);
    assert.deepEqual(refs.ghostTimestampsRef.current, { r1: 12345 });
    assert.deepEqual(state.ghostCards, {
        r1: { rusheeId: "r1", rusheeName: "Ada One", x: 10, y: 20, draggerName: "Other Admin" },
    });
    assert.deepEqual(state.lockedCards, { r1: "Other Admin" });
    assert.deepEqual(calls, ["viewers", "now", "ghosts", "locks"]);
});

test("self drag messages are ignored and active current drags join as ghosts", () => {
    // Verify self drag messages are ignored and active current drags join as ghosts.
    const { calls, state, refs, dependencies } = harness();
    refs.draggingRef.current = { id: "r1" };
    handleAdminSortingMessage({ type: "drag_start", ...remoteDrag }, dependencies);
    handleAdminSortingMessage({ type: "current_drag", active: true, ...remoteDrag }, dependencies);
    assert.deepEqual(calls, []);
    refs.draggingRef.current = null;
    handleAdminSortingMessage({ type: "current_drag", active: false, ...remoteDrag }, dependencies);
    assert.deepEqual(calls, []);
    handleAdminSortingMessage({ type: "current_drag", active: true, ...remoteDrag }, dependencies);
    assert.deepEqual(calls, ["now", "ghosts", "locks"]);
    assert.equal(state.ghostCards.r1.rusheeName, "Ada One");
});

test("remote drag movement refreshes timestamps even before its ghost appears", () => {
    // Verify remote drag movement refreshes timestamps even before its ghost appears.
    const { calls, state, refs, dependencies } = harness();
    const originalGhosts = state.ghostCards;
    handleAdminSortingMessage({ type: "drag_move", rushee_id: "r1", x: 30, y: 40 }, dependencies);
    assert.equal(state.ghostCards, originalGhosts);
    assert.equal(refs.ghostTimestampsRef.current.r1, 12345);
    assert.deepEqual(calls, ["now", "ghosts"]);

    handleAdminSortingMessage({ type: "drag_start", ...remoteDrag }, dependencies);
    handleAdminSortingMessage({ type: "drag_move", rushee_id: "r1", x: 30, y: 40 }, dependencies);
    assert.deepEqual(state.ghostCards.r1, {
        rusheeId: "r1", rusheeName: "Ada One", x: 30, y: 40, draggerName: "Other Admin",
    });
});

test("local drag movement does not create a remote ghost or refresh its timestamp", () => {
    // Verify local drag movement does not create a remote ghost or refresh its timestamp.
    const { calls, state, refs, dependencies } = harness();
    refs.draggingRef.current = { id: "r1" };
    handleAdminSortingMessage({ type: "drag_move", rushee_id: "r1", x: 30, y: 40 }, dependencies);
    assert.deepEqual(calls, []);
    assert.deepEqual(refs.ghostTimestampsRef.current, {});
    assert.deepEqual(state.ghostCards, {});
});

test("drag end clears ghost and lock while a missing ghost retains object identity", () => {
    // Verify drag end clears ghost and lock while a missing ghost retains object identity.
    const { calls, state, refs, dependencies } = harness();
    handleAdminSortingMessage({ type: "drag_start", ...remoteDrag }, dependencies);
    handleAdminSortingMessage({ type: "drag_end", rushee_id: "r1" }, dependencies);
    assert.deepEqual(state.ghostCards, {});
    assert.deepEqual(state.lockedCards, {});
    assert.deepEqual(refs.ghostTimestampsRef.current, {});
    const ghosts = state.ghostCards;
    const locks = state.lockedCards;
    handleAdminSortingMessage({ type: "drag_end", rushee_id: "missing" }, dependencies);
    assert.equal(state.ghostCards, ghosts);
    assert.equal(state.lockedCards, locks);
    assert.deepEqual(calls.slice(-2), ["ghosts", "locks"]);
});

test("drag denial locks the card and cancels only the matching local drag", () => {
    // Verify drag denial locks the card and cancels only the matching local drag.
    const { calls, state, refs, dependencies } = harness();
    refs.draggingRef.current = { id: "r1" };
    handleAdminSortingMessage({ type: "drag_denied", rushee_id: "r1", dragger_name: "Other" }, dependencies);
    assert.deepEqual(state.lockedCards, { r1: "Other" });
    assert.deepEqual(calls, ["locks", "cancel"]);
    handleAdminSortingMessage({ type: "drag_denied", rushee_id: "r2", dragger_name: "Another" }, dependencies);
    assert.deepEqual(calls, ["locks", "cancel", "locks"]);
});

test("card movement clears stale drag state and requests a refresh even without an ID", () => {
    // Verify card movement clears stale drag state and requests a refresh even without an ID.
    const { calls, state, refs, dependencies } = harness();
    handleAdminSortingMessage({ type: "drag_start", ...remoteDrag }, dependencies);
    handleAdminSortingMessage({ type: "card_moved", rushee_id: "r1" }, dependencies);
    assert.deepEqual(state.ghostCards, {});
    assert.deepEqual(state.lockedCards, {});
    assert.deepEqual(refs.ghostTimestampsRef.current, {});
    assert.deepEqual(calls.slice(-3), ["ghosts", "locks", "fetch"]);
    handleAdminSortingMessage({ type: "card_moved" }, dependencies);
    assert.deepEqual(calls.slice(-1), ["fetch"]);
});

test("unknown message types have no side effects", () => {
    // Verify unknown message types have no side effects.
    const { calls, dependencies } = harness();
    handleAdminSortingMessage({ type: "unknown" }, dependencies);
    assert.deepEqual(calls, []);
});
