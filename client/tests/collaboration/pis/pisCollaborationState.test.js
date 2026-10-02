import assert from "node:assert/strict";
import test from "node:test";

import {
    applyDocumentState,
    applyRemoteUpdates,
} from "../../../src/features/pis/collaborationState.js";

function stateHarness(initial = {}) {
    const state = {
        brotherA: initial.brotherA ?? { firstName: "Old A", lastName: "Old Last A" },
        brotherB: initial.brotherB ?? { firstName: "Old B", lastName: "Old Last B" },
        answers: initial.answers ?? { existing: "keep" },
    };
    const calls = [];
    const setters = {
        setBrotherA(update) { calls.push("A"); state.brotherA = update(state.brotherA); },
        setBrotherB(update) { calls.push("B"); state.brotherB = update(state.brotherB); },
        setAnswers(update) { calls.push("answers"); state.answers = update(state.answers); },
    };
    return { state, calls, setters };
}

test("empty document snapshots leave every local state untouched", () => {
    const harness = stateHarness();
    for (const documentState of [null, undefined, {}]) {
        applyDocumentState(documentState, harness.setters);
    }
    assert.deepEqual(harness.calls, []);
});

test("document snapshots merge brother fields in order and skip empty names", () => {
    const harness = stateHarness();
    applyDocumentState({
        _brotherA_firstName: "Ari",
        _brotherA_lastName: "",
        _brotherB_firstName: "Bea",
        _brotherB_lastName: "Two",
        question: "Yes",
        _brotherExtra: "not an answer",
    }, harness.setters);
    assert.deepEqual(harness.calls, ["A", "B", "B", "answers"]);
    assert.deepEqual(harness.state.brotherA, { firstName: "Ari", lastName: "Old Last A" });
    assert.deepEqual(harness.state.brotherB, { firstName: "Bea", lastName: "Two" });
    assert.deepEqual(harness.state.answers, { existing: "keep", question: "Yes" });
});

test("unchanged snapshot values keep state object identity", () => {
    const harness = stateHarness({
        brotherA: { firstName: "Ari", lastName: "One" },
        answers: { question: "Yes" },
    });
    const brotherA = harness.state.brotherA;
    const answers = harness.state.answers;
    applyDocumentState({ _brotherA_firstName: "Ari", question: "Yes" }, harness.setters);
    assert.deepEqual(harness.calls, ["A", "answers"]);
    assert.equal(harness.state.brotherA, brotherA);
    assert.equal(harness.state.answers, answers);
});

test("live updates apply only the latest event and allow brother names to clear", () => {
    const harness = stateHarness();
    applyRemoteUpdates([
        { field: "question", value: "ignored" },
        { field: "_brotherB_lastName", value: "" },
    ], harness.setters);
    assert.deepEqual(harness.calls, ["B"]);
    assert.deepEqual(harness.state.brotherB, { firstName: "Old B", lastName: "" });
    assert.deepEqual(harness.state.answers, { existing: "keep" });
});

test("live answers retain identity on no-op and accept unknown field names", () => {
    const harness = stateHarness({ answers: { question: "Yes" } });
    const original = harness.state.answers;
    applyRemoteUpdates([{ field: "question", value: "Yes" }], harness.setters);
    assert.equal(harness.state.answers, original);
    applyRemoteUpdates([{ field: "_brotherC_firstName", value: "New" }], harness.setters);
    assert.deepEqual(harness.state.answers, { question: "Yes", _brotherC_firstName: "New" });
    assert.deepEqual(harness.calls, ["answers", "answers"]);
});

test("missing or empty live update lists cause no state setter calls", () => {
    const harness = stateHarness();
    applyRemoteUpdates(null, harness.setters);
    applyRemoteUpdates([], harness.setters);
    assert.deepEqual(harness.calls, []);
});
