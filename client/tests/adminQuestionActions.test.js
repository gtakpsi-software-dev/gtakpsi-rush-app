import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import test from "node:test";

import { createQuestionActions } from "../src/features/admin/pis/questionActions.js";

const question = { question: "Why join?", question_type: "text", category: "Old" };

function setup({ categoryEdits = {}, questions = [], postResponse = { status: "success" }, getResponse } = {}) {
    const calls = [];
    const actions = createQuestionActions({
        apiBase: "/api/admin",
        categoryEdits,
        setPisQuestions: (value) => calls.push(["questions", value]),
        setPisQuestionsLoading: (value) => calls.push(["loading", value]),
        axios: {
            get: async (url) => {
                calls.push(["get", url]);
                const response = getResponse ?? { status: "success", payload: questions };
                if (response instanceof Error) throw response;
                return { data: response };
            },
            post: async (url, payload) => {
                calls.push(["post", url, payload]);
                if (postResponse instanceof Error) throw postResponse;
                return { data: postResponse };
            },
        },
        toast: {
            success: (message, options) => calls.push(["success", message, options]),
            error: (message, options) => calls.push(["error", message, options]),
        },
    });
    return { calls, actions };
}

test("loading sorts question copies by order and keeps unordered entries last", async () => {
    const unordered = { question: "No order" };
    const second = { question: "Second", order: 2 };
    const first = { question: "First", order: 1 };
    const payload = [unordered, second, first];
    const { calls, actions } = setup({ questions: payload });
    await actions.fetchPisQuestions();

    assert.deepEqual(calls.map(([kind]) => kind), ["loading", "get", "questions", "loading"]);
    assert.deepEqual(calls[2][1], [first, second, unordered]);
    assert.deepEqual(payload, [unordered, second, first]);
    assert.notEqual(calls[2][1], payload);
    assert.deepEqual(calls.at(-1), ["loading", false]);
});

test("category save trims edits, sends null for empty values, and refetches on success", async () => {
    const { calls, actions } = setup({ categoryEdits: { "Why join?": "   " } });
    await actions.saveQuestionCategory(question);
    await setImmediate();

    assert.deepEqual(calls[0], ["post", "/api/admin/update_pis_question_category", {
        question: "Why join?", question_type: "text", category: null,
    }]);
    assert.equal(calls[1][1], "Category updated!");
    assert.deepEqual(calls.slice(2).map(([kind]) => kind), ["loading", "get", "questions", "loading"]);

    const fallback = setup();
    await fallback.actions.saveQuestionCategory(question);
    assert.equal(fallback.calls[0][2].category, "Old");
});

test("failed category writes do not refetch and preserve error messages", async () => {
    const rejected = setup({ postResponse: { status: "error", message: "Denied" } });
    await rejected.actions.saveQuestionCategory(question);
    assert.equal(rejected.calls[1][1], "Denied");
    assert.ok(!rejected.calls.some(([kind]) => kind === "get"));

    const offline = setup({ postResponse: new Error("offline") });
    await offline.actions.saveQuestionCategory(question);
    assert.equal(offline.calls[1][1], "An error occurred");
});

test("question load failure preserves its toast and clears loading", async () => {
    const { calls, actions } = setup({ getResponse: new Error("offline") });
    await actions.fetchPisQuestions();
    assert.equal(calls[2][1], "Failed to load PIS questions");
    assert.deepEqual(calls.at(-1), ["loading", false]);
});
