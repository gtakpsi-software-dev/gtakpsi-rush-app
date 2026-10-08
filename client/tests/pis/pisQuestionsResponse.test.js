import assert from "node:assert/strict";
import test from "node:test";

import { applyPisQuestionsResponse } from "../../src/features/pis/applyPisQuestionsResponse.js";

// Create response handlers that capture question-availability updates.
function handlers(overrides = {}) {
    const calls = [];
    return {
        calls,
        values: {
            // Record set questions calls for assertions.
            setQuestions: (questions) => calls.push(["questions", questions]),
            // Record set questions available calls for assertions.
            setQuestionsAvailable: (available) => calls.push(["available", available]),
            // Record set reveal at calls for assertions.
            setRevealAt: (date) => calls.push(["revealAt", date]),
            ...overrides,
        },
    };
}

test("PIS question responses preserve server order, availability, and BSON date parsing", () => {
    // Verify PIS question responses preserve server order, availability, and BSON date parsing.
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
    assert.deepEqual(calls.map(/* Return kind to the caller. */ ([kind]) => kind), ["questions", "available", "revealAt"]);
    assert.equal(calls[0][1], questions);
    assert.equal(calls[1][1], false);
    assert.equal(calls[2][1].getTime(), 1712345678901);
});

test("initial-load failure invokes its error route while poll failure stays silent", () => {
    // Verify initial-load failure invokes its error route while poll failure stays silent.
    const { calls, values } = handlers({
        // Record on failure calls for assertions.
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
    // Verify successful response without a reveal time retains null.
    const { calls, values } = handlers();
    applyPisQuestionsResponse({ data: {
        status: "success",
        payload: { available: true, reveal_at: null, questions: [] },
    } }, values);
    assert.deepEqual(calls.slice(0, 2), [["questions", []], ["available", true]]);
    assert.equal(calls[2][1], null);
});
