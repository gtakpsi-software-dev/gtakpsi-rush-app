import assert from "node:assert/strict";
import test from "node:test";

import { createPisAnswerHandlers } from "../../src/features/pis/createPisAnswerHandlers.js";

function harness(isConnected) {
    let answers = { existing: "kept" };
    const events = [];
    const handlers = createPisAnswerHandlers({
        setAnswers(updater) {
            answers = updater(answers);
            events.push(["answers", { ...answers }]);
        },
        collaboration: {
            isConnected,
            sendTextUpdate: (...args) => events.push(["send", ...args]),
        },
    });
    return { handlers, events, answers: () => answers };
}

test("text answers stay local for typing and send only voice-originated changes", () => {
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
