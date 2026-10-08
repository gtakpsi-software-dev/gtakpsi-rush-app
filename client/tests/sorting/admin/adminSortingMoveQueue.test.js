import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers";

import { processSortingMoveQueue } from "../../../src/features/sorting/processSortingMoveQueue.js";

// Create a promise whose resolution and rejection the test controls.
function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => {
        // Expose the promise settlement callbacks to the test.
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
}

// Create isolated state, dependency fakes, and captured calls for this test.
function setup(moves, persistMove = /* Leave this mocked callback inert. */ async () => {}) {
    const moveInFlightRef = { current: false };
    const pendingMovesRef = { current: [...moves] };
    const fetchDataRef = { current: null };
    const sent = [];
    const errors = [];
    const deps = {
        moveInFlightRef,
        pendingMovesRef,
        fetchDataRef,
        persistMove,
        // Record ws send calls for assertions.
        wsSend: (message) => sent.push(message),
        // Record show error calls for assertions.
        showError: (message) => errors.push(message),
    };
    return { deps, moveInFlightRef, pendingMovesRef, fetchDataRef, sent, errors };
}

test("empty and already-running queues do not start another request", async () => {
    // Verify empty and already-running queues do not start another request.
    let calls = 0;
    const state = setup([], async () => {
        // Update calls in the test harness.
         calls += 1; });

    await processSortingMoveQueue(state.deps);
    assert.equal(calls, 0);
    assert.equal(state.moveInFlightRef.current, false);

    state.pendingMovesRef.current.push({ movedRusheeId: "r1" });
    state.moveInFlightRef.current = true;
    await processSortingMoveQueue(state.deps);
    assert.equal(calls, 0);
    assert.equal(state.pendingMovesRef.current.length, 1);
});

test("moves persist one at a time and broadcast each successful saved card", async () => {
    // Verify moves persist one at a time and broadcast each successful saved card.
    const first = { movedRusheeId: "r1", toColumn: "IN_CLOUD" };
    const second = { movedRusheeId: "r2", toColumn: "OUT_CLOUD" };
    const firstRequest = deferred();
    const calls = [];
    const state = setup([first, second], (move) => {
        // Record moves and hold the first request until explicitly resolved.
        calls.push(move);
        return move === first ? firstRequest.promise : Promise.resolve();
    });

    const processing = processSortingMoveQueue(state.deps);
    assert.deepEqual(calls, [first]);
    assert.deepEqual(state.pendingMovesRef.current, [second]);
    assert.equal(state.moveInFlightRef.current, true);

    firstRequest.resolve();
    await processing;
    await new Promise(setImmediate);
    assert.deepEqual(calls, [first, second]);
    assert.deepEqual(state.sent, [
        { type: "card_saved", rushee_id: "r1", new_status: "IN_CLOUD" },
        { type: "card_saved", rushee_id: "r2", new_status: "OUT_CLOUD" },
    ]);
    assert.equal(state.moveInFlightRef.current, false);
    assert.deepEqual(state.pendingMovesRef.current, []);
});

test("incomplete move payloads still persist but do not broadcast", async () => {
    // Verify incomplete move payloads still persist but do not broadcast.
    const move = { movedRusheeId: "r1" };
    const calls = [];
    const state = setup([move], async (next) => {
        // Record callback arguments for assertions.
         calls.push(next); });

    await processSortingMoveQueue(state.deps);
    assert.deepEqual(calls, [move]);
    assert.deepEqual(state.sent, []);
});

test("failed moves discard pending work and wait for the rollback fetch", async () => {
    // Verify failed moves discard pending work and wait for the rollback fetch.
    const first = { movedRusheeId: "r1", toColumn: "IN_CLOUD" };
    const second = { movedRusheeId: "r2", toColumn: "OUT_CLOUD" };
    const rollback = deferred();
    const calls = [];
    const state = setup([first, second], async (move) => {
        // Record the move and simulate a save failure.
        calls.push(move);
        throw new Error("save failed");
    });
    let fetches = 0;
    state.fetchDataRef.current = () => {
        // Count reloads and wait for the controlled rollback request.
        fetches += 1;
        return rollback.promise;
    };

    const processing = processSortingMoveQueue(state.deps);
    await new Promise(setImmediate);
    assert.deepEqual(calls, [first]);
    assert.deepEqual(state.pendingMovesRef.current, []);
    assert.deepEqual(state.errors, ["Failed to save order; reverting"]);
    assert.equal(fetches, 1);
    assert.equal(state.moveInFlightRef.current, true);
    assert.deepEqual(state.sent, []);

    rollback.resolve();
    await processing;
    assert.equal(state.moveInFlightRef.current, false);
    assert.deepEqual(calls, [first]);
});
