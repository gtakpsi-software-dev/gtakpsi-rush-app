import assert from "node:assert/strict";
import test from "node:test";

import { startPisRevealPolling } from "../../src/features/pis/startPisRevealPolling.js";

function harness(overrides = {}) {
    const events = [];
    let currentTime = 1000;
    let tick;
    const interval = {};
    const deps = {
        revealAt: new Date(1500),
        api: "/api",
        gtid: "900000001",
        get: async (url) => {
            events.push(["get", url]);
            return { data: { status: "success", payload: {
                available: true, reveal_at: null, questions: [{ question: "Why?" }],
            } } };
        },
        setQuestions: (value) => events.push(["questions", value]),
        setQuestionsAvailable: (value) => events.push(["available", value]),
        setRevealAt: (value) => events.push(["revealAt", value]),
        now: () => currentTime,
        scheduleInterval: (callback, delay) => {
            events.push(["interval", delay]);
            tick = callback;
            return interval;
        },
        clearScheduledInterval: (value) => events.push(["clear", value]),
        ...overrides,
    };
    return {
        deps,
        events,
        interval,
        tick: () => tick(),
        setTime: (value) => { currentTime = value; },
    };
}

test("reveal polling checks immediately, preserves rounded threshold, and clears its interval", async () => {
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
    const poll = harness({
        revealAt: new Date(0),
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
