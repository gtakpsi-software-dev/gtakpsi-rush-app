import assert from "node:assert/strict";
import test from "node:test";

import { cleanupStaleSortingGhosts } from "../src/features/sorting/cleanupStaleSortingGhosts.js";

function harness(timestamps) {
    const calls = [];
    const state = {
        ghosts: { stale: { x: 1 }, boundary: { x: 2 }, fresh: { x: 3 } },
        locks: { stale: "A", boundary: "B", fresh: "C" },
    };
    const dependencies = {
        ghostTimestampsRef: { current: { ...timestamps } },
        setGhostCards: (update) => { calls.push("ghosts"); state.ghosts = update(state.ghosts); },
        setLockedCards: (update) => { calls.push("locks"); state.locks = update(state.locks); },
        now: () => { calls.push("now"); return 60000; },
        log: (...values) => calls.push(["log", ...values]),
    };
    return { calls, state, dependencies };
}

test("cleanup removes only ghosts strictly older than thirty seconds", () => {
    const { calls, state, dependencies } = harness({ stale: 29999, boundary: 30000, fresh: 30001 });
    cleanupStaleSortingGhosts(dependencies);
    assert.deepEqual(dependencies.ghostTimestampsRef.current, { boundary: 30000, fresh: 30001 });
    assert.deepEqual(state.ghosts, { boundary: { x: 2 }, fresh: { x: 3 } });
    assert.deepEqual(state.locks, { boundary: "B", fresh: "C" });
    assert.deepEqual(calls, [
        "now", ["log", "Cleaning up stale ghosts:", ["stale"]], "ghosts", "locks",
    ]);
});

test("cleanup leaves React state untouched when all ghosts are recent", () => {
    const { calls, state, dependencies } = harness({ boundary: 30000, fresh: 30001 });
    const ghosts = state.ghosts;
    const locks = state.locks;
    cleanupStaleSortingGhosts(dependencies);
    assert.equal(state.ghosts, ghosts);
    assert.equal(state.locks, locks);
    assert.deepEqual(calls, ["now"]);
});

test("cleanup prunes multiple stale IDs from both maps in enumeration order", () => {
    const { calls, state, dependencies } = harness({ stale: 1, extra: 2, fresh: 30001 });
    state.ghosts.extra = { x: 4 };
    state.locks.extra = "D";
    cleanupStaleSortingGhosts(dependencies);
    assert.deepEqual(dependencies.ghostTimestampsRef.current, { fresh: 30001 });
    assert.deepEqual(state.ghosts, { boundary: { x: 2 }, fresh: { x: 3 } });
    assert.deepEqual(state.locks, { boundary: "B", fresh: "C" });
    assert.deepEqual(calls[1], ["log", "Cleaning up stale ghosts:", ["stale", "extra"]]);
});

test("viewer cleanup removes stale ghosts without requiring a lock map", () => {
    const { calls, state, dependencies } = harness({ stale: 29999, boundary: 30000 });
    delete dependencies.setLockedCards;
    cleanupStaleSortingGhosts(dependencies);
    assert.deepEqual(dependencies.ghostTimestampsRef.current, { boundary: 30000 });
    assert.deepEqual(state.ghosts, { boundary: { x: 2 }, fresh: { x: 3 } });
    assert.deepEqual(calls, [
        "now", ["log", "Cleaning up stale ghosts:", ["stale"]], "ghosts",
    ]);
});
