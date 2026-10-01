import assert from "node:assert/strict";
import test from "node:test";

import { applyPisRusheeResponse } from "../src/features/pis/applyPisRusheeResponse.js";

function harness(initialAnswers = { live: "live answer", shared: "live value" }) {
    const calls = [];
    const state = { answers: initialAnswers };
    const handlers = {
        setRushee: (rushee) => calls.push(["rushee", rushee]),
        setAnswers: (update) => {
            state.answers = update(state.answers);
            calls.push(["answers", state.answers]);
        },
        setBrotherA: (brother) => calls.push(["A", brother]),
        setBrotherB: (brother) => calls.push(["B", brother]),
        navigate: (path) => calls.push(["navigate", path]),
        errorTitle: "Load Error",
        log: (...values) => calls.push(["log", ...values]),
    };
    return { calls, state, handlers };
}

test("PIS rushee data merges answers before initializing names from signup", () => {
    const { calls, state, handlers } = harness();
    const signup = {
        first_brother_first_name: " Ari ", first_brother_last_name: "none",
        second_brother_first_name: null, second_brother_last_name: " Two ",
    };
    const rushee = {
        pis: [{ question: "shared", answer: "database value" }, { question: "new", answer: "new answer" }],
        pis_signup: signup,
    };
    applyPisRusheeResponse({ data: { status: "success", payload: rushee } }, handlers);
    assert.deepEqual(state.answers, {
        live: "live answer", shared: "database value", new: "new answer",
    });
    assert.deepEqual(calls, [
        ["rushee", rushee],
        ["answers", state.answers],
        ["log", "Initializing brother names:", {
            brotherA: { firstName: "Ari", lastName: "" },
            brotherB: { firstName: "", lastName: "Two" },
            rawSignup: signup,
        }],
        ["A", { firstName: "Ari", lastName: "" }],
        ["B", { firstName: "", lastName: "Two" }],
    ]);
});

test("missing signup still loads the rushee and merges existing answers", () => {
    const { calls, state, handlers } = harness();
    const previousAnswers = state.answers;
    const rushee = { pis: null, pis_signup: null };
    applyPisRusheeResponse({ data: { status: "success", payload: rushee } }, handlers);
    assert.deepEqual(calls, [
        ["rushee", rushee],
        ["answers", { live: "live answer", shared: "live value" }],
    ]);
    assert.notEqual(state.answers, previousAnswers);
});

test("non-success response keeps the original error route", () => {
    const { calls, handlers } = harness();
    applyPisRusheeResponse({ data: { status: "error" } }, handlers);
    assert.deepEqual(calls, [["navigate", "/error/Load Error/Rushee with this GTID does not exist"]]);
});

test("malformed non-string signup names still propagate the original error", () => {
    const { calls, handlers } = harness();
    const rushee = {
        pis: [],
        pis_signup: {
            first_brother_first_name: 123,
            first_brother_last_name: "",
            second_brother_first_name: "",
            second_brother_last_name: "",
        },
    };
    assert.throws(() => applyPisRusheeResponse({ data: { status: "success", payload: rushee } }, handlers), TypeError);
    assert.deepEqual(calls.map(([kind]) => kind), ["rushee", "answers"]);
});
