import assert from "node:assert/strict";
import test from "node:test";

import { startSortingConnectionLifecycle } from "../../../src/features/sorting/startSortingConnectionLifecycle.js";

test("sorting connection starts before its sweep and clears the timer without a socket", () => {
    const events = [];
    const wsRef = { current: null };
    let sweep;
    const cleanup = startSortingConnectionLifecycle({
        wsRef,
        connect: () => events.push("connect"),
        sweep: () => events.push("sweep"),
        schedule: (callback, delay) => {
            events.push(["schedule", delay]);
            sweep = callback;
            return 7;
        },
        clear: (id) => events.push(["clear", id]),
    });

    assert.deepEqual(events, ["connect", ["schedule", 5000]]);
    sweep();
    cleanup();
    assert.deepEqual(events, ["connect", ["schedule", 5000], "sweep", ["clear", 7]]);
});
