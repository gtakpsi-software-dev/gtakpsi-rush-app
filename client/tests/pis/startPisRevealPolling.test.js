import assert from "node:assert/strict";
import test from "node:test";

import { startPisRevealPolling } from "../../src/features/pis/startPisRevealPolling.js";

// Create isolated state, dependency fakes, and captured calls for this test.
function harness(overrides = {}) {
    const events = [];
    let currentTime = 1000;
    let tick;
    const interval = {};
    const deps = {
        revealAt: new Date(1500),
        api: "/api",
        gtid: "900000001",
        // Record polling and return revealed questions.
        get: async (url) => {
            events.push(["get", url]);
            return { data: { status: "success", payload: {
                available: true, reveal_at: null, questions: [{ question: "Why?" }],
            } } };
        },
        // Record set questions calls for assertions.
        setQuestions: (value) => events.push(["questions", value]),
        // Record set questions available calls for assertions.
        setQuestionsAvailable: (value) => events.push(["available", value]),
        // Record set reveal at calls for assertions.
        setRevealAt: (value) => events.push(["revealAt", value]),
        // Return current time to the caller.
        now: () => currentTime,
        // Capture the poll callback and return its interval handle.
        scheduleInterval: (callback, delay) => {
            events.push(["interval", delay]);
            tick = callback;
            return interval;
        },
        // Record clear scheduled interval calls for assertions.
        clearScheduledInterval: (value) => events.push(["clear", value]),
        ...overrides,
    };
    return {
        deps,
        events,
        interval,
        // Invoke tick with the test inputs.
        tick: () => tick(),
        // Update currentTime in the test harness.
        setTime: (value) => { currentTime = value; },
    };
}

test("reveal polling checks immediately, preserves rounded threshold, and clears its interval", async () => {
    // Verify reveal polling checks immediately, preserves rounded threshold, and clears its interval.
    const poll = harness();
    const stop = startPisRevealPolling(poll.deps);
    assert.deepEqual(poll.events, [["interval", 1000]]);

    poll.setTime(1000);
    poll.tick();
    assert.deepEqual(poll.events, [["interval", 1000]]);

    poll.setTime(1001);
    poll.tick();
    await Promise.resolve();
    assert.deepEqual(poll.events.slice(1), [
        ["get", "/api/rushee/get-pis-questions/900000001"],
        ["questions", [{ question: "Why?" }]],
        ["available", true],
        ["revealAt", null],
    ]);

    stop();
    assert.deepEqual(poll.events.at(-1), ["clear", poll.interval]);
});

test("an already revealed time retries each tick and ignores failed question responses", async () => {
    // Verify an already revealed time retries each tick and ignores failed question responses.
    const poll = harness({
        revealAt: new Date(0),
        // Record polling and return an application error response.
        get: async (url) => {
            poll.events.push(["get", url]);
            return { data: { status: "error" } };
        },
    });
    const stop = startPisRevealPolling(poll.deps);
    await Promise.resolve();
    poll.tick();
    await Promise.resolve();
    assert.deepEqual(poll.events, [
        ["get", "/api/rushee/get-pis-questions/900000001"],
        ["interval", 1000],
        ["get", "/api/rushee/get-pis-questions/900000001"],
    ]);
    stop();
});
