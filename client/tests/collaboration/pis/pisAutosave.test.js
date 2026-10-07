import assert from "node:assert/strict";
import test from "node:test";

import { performPisAutosave } from "../../../src/features/pis/performPisAutosave.js";
import { SAVE_STATUS } from "../../../src/features/pis/saveStatus.js";

function setup(overrides = {}) {
    const calls = [];
    const scheduled = [];
    const savedAt = new Date("2026-09-30T12:00:00Z");
    const args = {
        questions: [
            { question: "Why join?" },
            { question: "Can you attend?" },
        ],
        answers: { "Why join?": "Community" },
        brotherA: { firstName: "Ari", lastName: "One" },
        brotherB: { firstName: "Bea", lastName: "Two" },
        gtid: "123",
        api: "/api",
        axios: { post: async (...request) => { calls.push(["post", ...request]); } },
        setSaveStatus: (status) => calls.push(["status", status]),
        setLastSaved: (date) => calls.push(["savedAt", date]),
        now: () => savedAt,
        schedule: (callback, delay) => scheduled.push({ callback, delay }),
        logError: (...values) => calls.push(["log", ...values]),
        ...overrides,
    };
    return { args, calls, scheduled, savedAt };
}

test("autosave skips missing questions or GTID without changing state", async () => {
    for (const overrides of [{ questions: [] }, { gtid: null }]) {
        const { args, calls, scheduled } = setup(overrides);
        await performPisAutosave(args);
        assert.deepEqual(calls, []);
        assert.deepEqual(scheduled, []);
    }
});

test("autosave retains request fields, success transition, and two-second reset", async () => {
    const { args, calls, scheduled, savedAt } = setup();
    await performPisAutosave(args);
    assert.deepEqual(calls, [
        ["status", SAVE_STATUS.SAVING],
        ["post", "/api/rushee/autosave-pis/123", {
            pis_responses: [
                { question: "Why join?", answer: "Community" },
                { question: "Can you attend?", answer: "" },
            ],
            brother_a_first_name: "Ari",
            brother_a_last_name: "One",
            brother_b_first_name: "Bea",
            brother_b_last_name: "Two",
        }],
        ["status", SAVE_STATUS.SAVED],
        ["savedAt", savedAt],
    ]);
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0].delay, 2000);
    scheduled[0].callback();
    assert.deepEqual(calls.at(-1), ["status", SAVE_STATUS.IDLE]);
});

test("failed request logs the error, reports failure, and resets after three seconds", async () => {
    const error = new Error("offline");
    const { args, calls, scheduled } = setup({
        axios: { post: async () => { throw error; } },
    });
    await performPisAutosave(args);
    assert.deepEqual(calls, [
        ["status", SAVE_STATUS.SAVING],
        ["log", "Autosave error:", error],
        ["status", SAVE_STATUS.ERROR],
    ]);
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0].delay, 3000);
    scheduled[0].callback();
    assert.deepEqual(calls.at(-1), ["status", SAVE_STATUS.IDLE]);
});
