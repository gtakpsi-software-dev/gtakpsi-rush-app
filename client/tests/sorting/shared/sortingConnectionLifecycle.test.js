import assert from "node:assert/strict";
import test from "node:test";

import { startSortingConnectionLifecycle } from "../../../src/features/sorting/startSortingConnectionLifecycle.js";

test("sorting connection starts before its sweep and clears the timer without a socket", () => {
    // Verify sorting connection starts before its sweep and clears the timer without a socket.
    const events = [];
    const wsRef = { current: null };
    let sweep;
    const cleanup = startSortingConnectionLifecycle({
        wsRef,
        // Record connect calls for assertions.
        connect: () => events.push("connect"),
        // Record sweep calls for assertions.
        sweep: () => events.push("sweep"),
        // Capture the cleanup sweep and return a fixed timer handle.
        schedule: (callback, delay) => {
            events.push(["schedule", delay]);
            sweep = callback;
            return 7;
        },
        // Record clear calls for assertions.
        clear: (id) => events.push(["clear", id]),
    });

    assert.deepEqual(events, ["connect", ["schedule", 5000]]);
    sweep();
    cleanup();
    assert.deepEqual(events, ["connect", ["schedule", 5000], "sweep", ["clear", 7]]);
});
