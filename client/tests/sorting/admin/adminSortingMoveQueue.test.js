import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers";

import { processSortingMoveQueue } from "../../../src/features/sorting/processSortingMoveQueue.js";

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
}

function setup(moves, persistMove = async () => {}) {
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
        wsSend: (message) => sent.push(message),
        showError: (message) => errors.push(message),
    };
    return { deps, moveInFlightRef, pendingMovesRef, fetchDataRef, sent, errors };
}

test("empty and already-running queues do not start another request", async () => {
    let calls = 0;
    const state = setup([], async () => { calls += 1; });

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
    const first = { movedRusheeId: "r1", toColumn: "IN_CLOUD" };
    const second = { movedRusheeId: "r2", toColumn: "OUT_CLOUD" };
    const firstRequest = deferred();
    const calls = [];
    const state = setup([first, second], (move) => {
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
    const move = { movedRusheeId: "r1" };
    const calls = [];
    const state = setup([move], async (next) => { calls.push(next); });

    await processSortingMoveQueue(state.deps);
    assert.deepEqual(calls, [move]);
    assert.deepEqual(state.sent, []);
});

test("failed moves discard pending work and wait for the rollback fetch", async () => {
    const first = { movedRusheeId: "r1", toColumn: "IN_CLOUD" };
    const second = { movedRusheeId: "r2", toColumn: "OUT_CLOUD" };
    const rollback = deferred();
    const calls = [];
    const state = setup([first, second], async (move) => {
        calls.push(move);
        throw new Error("save failed");
    });
    let fetches = 0;
    state.fetchDataRef.current = () => {
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
