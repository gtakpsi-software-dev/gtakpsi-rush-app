import assert from "node:assert/strict";
import test from "node:test";

import { createPisAnswerHandlers } from "../../src/features/pis/createPisAnswerHandlers.js";

// Create isolated state, dependency fakes, and captured calls for this test.
function harness(isConnected) {
    let answers = { existing: "kept" };
    const events = [];
    const handlers = createPisAnswerHandlers({
        // Apply an answer updater and capture the resulting answer snapshot.
        setAnswers(updater) {
            answers = updater(answers);
            events.push(["answers", { ...answers }]);
        },
        collaboration: {
            isConnected,
            // Record send text update calls for assertions.
            sendTextUpdate: (...args) => events.push(["send", ...args]),
        },
    });
    return { handlers, events, answers: /* Return answers to the caller. */ () => answers };
}

test("text answers stay local for typing and send only voice-originated changes", () => {
    // Verify text answers stay local for typing and send only voice-originated changes.
    const { handlers, events, answers } = harness(true);
    handlers.handleAnswerChange("question", "typed");
    handlers.handleAnswerChange("question", "still typed", { source: "typing" });
    handlers.handleAnswerChange("question", "spoken", { source: "voice" });

    assert.deepEqual(events, [
        ["answers", { existing: "kept", question: "typed" }],
        ["answers", { existing: "kept", question: "still typed" }],
        ["answers", { existing: "kept", question: "spoken" }],
        ["send", "question", "spoken"],
    ]);
    assert.deepEqual(answers(), { existing: "kept", question: "spoken" });
});

test("multiple choice sends immediately when connected and both handlers stay local offline", () => {
    // Verify multiple choice sends immediately when connected and both handlers stay local offline.
    const online = harness(true);
    online.handlers.handleMCChange("choice", "B");
    assert.deepEqual(online.events, [
        ["answers", { existing: "kept", choice: "B" }],
        ["send", "choice", "B"],
    ]);

    const offline = harness(false);
    offline.handlers.handleAnswerChange("voice", "spoken", { source: "voice" });
    offline.handlers.handleMCChange("choice", "A");
    assert.deepEqual(offline.events, [
        ["answers", { existing: "kept", voice: "spoken" }],
        ["answers", { existing: "kept", voice: "spoken", choice: "A" }],
    ]);
});
