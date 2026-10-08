import assert from "node:assert/strict";
import test from "node:test";

import { clearLocalChangeTimers, scheduleLocalChangeTimers } from "../../../src/features/collaboration/scheduleLocalChangeTimers.js";

// Create isolated state, dependency fakes, and captured calls for this test.
function setup() {
    const timers = new Map();
    let nextId = 1;
    const options = {
        pendingLocalChangeRef: { current: true },
        pendingLocalChangeTimeoutRef: { current: null },
        debounceTimerRef: { current: null },
        lastSentValueRef: { current: "Before" },
        collaboration: { isConnected: false, /* Provide an inert send text update stub for this test. */ sendTextUpdate() {} },
        fieldKey: "notes",
        value: "First",
        debounceMs: 300,
        allowSend: true,
        // Store scheduled callbacks and return deterministic timer IDs.
        schedule(callback, delay) {
            const id = nextId++;
            timers.set(id, { callback, delay });
            return id;
        },
        // Invoke timers.delete with the test inputs.
        cancel: (id) => timers.delete(id),
    };
    return { options, timers };
}

test("pending local changes expire even when the editor is offline", () => {
    // Verify pending local changes expire even when the editor is offline.
    const { options, timers } = setup();
    scheduleLocalChangeTimers(options);

    assert.deepEqual(Array.from(timers.values(), /* Return delay to the caller. */ ({ delay }) => delay), [2000]);
    timers.get(options.pendingLocalChangeTimeoutRef.current).callback();
    assert.equal(options.pendingLocalChangeRef.current, false);
    assert.equal(options.lastSentValueRef.current, "Before");
});

test("a newer change replaces both timers while a composing editor keeps its queued send", () => {
    // Verify a newer change replaces both timers while a composing editor keeps its queued send.
    const { options, timers } = setup();
    const messages = [];
    options.collaboration = {
        isConnected: true,
        // Record send text update calls for assertions.
        sendTextUpdate: (...args) => messages.push(args),
    };
    scheduleLocalChangeTimers(options);
    const firstPendingId = options.pendingLocalChangeTimeoutRef.current;
    const firstSendId = options.debounceTimerRef.current;

    scheduleLocalChangeTimers({ ...options, value: "Latest" });
    assert.equal(timers.has(firstPendingId), false);
    assert.equal(timers.has(firstSendId), false);
    const latestSendId = options.debounceTimerRef.current;

    scheduleLocalChangeTimers({ ...options, value: "Composing", allowSend: false });
    assert.equal(options.debounceTimerRef.current, latestSendId);
    assert.deepEqual(Array.from(timers.values(),
        /* Return delay to the caller. */
        ({ delay }) => delay).sort(
        /* Sort timer delays in ascending order. */
        (a, b) => a - b), [300, 2000]);

    timers.get(latestSendId).callback();
    assert.deepEqual(messages, [["notes", "Latest"]]);
    assert.equal(options.lastSentValueRef.current, "Latest");

    clearLocalChangeTimers(options);
    assert.equal(timers.size, 0);
});
