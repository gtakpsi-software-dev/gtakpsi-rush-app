import assert from "node:assert/strict";
import test from "node:test";

import { applyPisQuestionsResponse } from "../../src/features/pis/applyPisQuestionsResponse.js";

function handlers(overrides = {}) {
    const calls = [];
    return {
        calls,
        values: {
            setQuestions: (questions) => calls.push(["questions", questions]),
            setQuestionsAvailable: (available) => calls.push(["available", available]),
            setRevealAt: (date) => calls.push(["revealAt", date]),
            ...overrides,
        },
    };
}

test("PIS question responses preserve server order, availability, and BSON date parsing", () => {
    const { calls, values } = handlers();
    const questions = [{ question: "Fixed" }, { question: "Random" }];
    applyPisQuestionsResponse({ data: {
        status: "success",
        payload: {
            available: false,
            reveal_at: { $date: { $numberLong: "1712345678901" } },
            questions,
        },
    } }, values);
    assert.deepEqual(calls.map(([kind]) => kind), ["questions", "available", "revealAt"]);
    assert.equal(calls[0][1], questions);
    assert.equal(calls[1][1], false);
    assert.equal(calls[2][1].getTime(), 1712345678901);
});

test("initial-load failure invokes its error route while poll failure stays silent", () => {
    const { calls, values } = handlers({
        onFailure: () => calls.push(["navigate", "/error/Load Error/Failed to fetch PIS questions"]),
    });
    const failed = { data: { status: "error" } };
    applyPisQuestionsResponse(failed, values);
    assert.deepEqual(calls, [["navigate", "/error/Load Error/Failed to fetch PIS questions"]]);

    const poll = handlers();
    applyPisQuestionsResponse(failed, poll.values);
    assert.deepEqual(poll.calls, []);
});

test("successful response without a reveal time retains null", () => {
    const { calls, values } = handlers();
    applyPisQuestionsResponse({ data: {
        status: "success",
        payload: { available: true, reveal_at: null, questions: [] },
    } }, values);
    assert.deepEqual(calls.slice(0, 2), [["questions", []], ["available", true]]);
    assert.equal(calls[2][1], null);
});
