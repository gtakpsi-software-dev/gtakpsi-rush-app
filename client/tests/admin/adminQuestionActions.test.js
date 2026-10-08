import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import test from "node:test";

import { createQuestionActions } from "../../src/features/admin/pis/questionActions.js";

const question = { question: "Why join?", question_type: "text", category: "Old" };

// Create isolated state, dependency fakes, and captured calls for this test.
function setup({ categoryEdits = {}, questions = [], postResponse = { status: "success" }, getResponse } = {}) {
    const calls = [];
    const actions = createQuestionActions({
        apiBase: "/api/admin",
        categoryEdits,
        // Record set pis questions calls for assertions.
        setPisQuestions: (value) => calls.push(["questions", value]),
        // Record set pis questions loading calls for assertions.
        setPisQuestionsLoading: (value) => calls.push(["loading", value]),
        axios: {
            // Record the GET request and return questions or the configured error.
            get: async (url) => {
                calls.push(["get", url]);
                const response = getResponse ?? { status: "success", payload: questions };
                if (response instanceof Error) throw response;
                return { data: response };
            },
            // Record the POST request and return or throw its configured response.
            post: async (url, payload) => {
                calls.push(["post", url, payload]);
                if (postResponse instanceof Error) throw postResponse;
                return { data: postResponse };
            },
        },
        toast: {
            // Record success calls for assertions.
            success: (message, options) => calls.push(["success", message, options]),
            // Record error calls for assertions.
            error: (message, options) => calls.push(["error", message, options]),
        },
    });
    return { calls, actions };
}

test("loading sorts question copies by order and keeps unordered entries last", async () => {
    // Verify loading sorts question copies by order and keeps unordered entries last.
    const unordered = { question: "No order" };
    const second = { question: "Second", order: 2 };
    const first = { question: "First", order: 1 };
    const payload = [unordered, second, first];
    const { calls, actions } = setup({ questions: payload });
    await actions.fetchPisQuestions();

    assert.deepEqual(calls.map(/* Return kind to the caller. */ ([kind]) => kind), ["loading", "get", "questions", "loading"]);
    assert.deepEqual(calls[2][1], [first, second, unordered]);
    assert.deepEqual(payload, [unordered, second, first]);
    assert.notEqual(calls[2][1], payload);
    assert.deepEqual(calls.at(-1), ["loading", false]);
});

test("category save trims edits, sends null for empty values, and refetches on success", async () => {
    // Verify category save trims edits, sends null for empty values, and refetches on success.
    const { calls, actions } = setup({ categoryEdits: { "Why join?": "   " } });
    await actions.saveQuestionCategory(question);
    await setImmediate();

    assert.deepEqual(calls[0], ["post", "/api/admin/update_pis_question_category", {
        question: "Why join?", question_type: "text", category: null,
    }]);
    assert.equal(calls[1][1], "Category updated!");
    assert.deepEqual(calls.slice(2).map(/* Return kind to the caller. */ ([kind]) => kind), ["loading", "get", "questions", "loading"]);

    const fallback = setup();
    await fallback.actions.saveQuestionCategory(question);
    assert.equal(fallback.calls[0][2].category, "Old");
});

test("failed category writes do not refetch and preserve error messages", async () => {
    // Verify failed category writes do not refetch and preserve error messages.
    const rejected = setup({ postResponse: { status: "error", message: "Denied" } });
    await rejected.actions.saveQuestionCategory(question);
    assert.equal(rejected.calls[1][1], "Denied");
    assert.ok(!rejected.calls.some(/* Select recorded get calls. */ ([kind]) => kind === "get"));

    const offline = setup({ postResponse: new Error("offline") });
    await offline.actions.saveQuestionCategory(question);
    assert.equal(offline.calls[1][1], "An error occurred");
});

test("question load failure preserves its toast and clears loading", async () => {
    // Verify question load failure preserves its toast and clears loading.
    const { calls, actions } = setup({ getResponse: new Error("offline") });
    await actions.fetchPisQuestions();
    assert.equal(calls[2][1], "Failed to load PIS questions");
    assert.deepEqual(calls.at(-1), ["loading", false]);
});
