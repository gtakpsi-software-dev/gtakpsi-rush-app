import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../../src/features/pis/PisQuestionResponses.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("../fixtures/pisQuestionResponses.json", import.meta.url));
// Render a lightweight React element for component assertions.
const CollaborativeTextarea = () => React.createElement("textarea", { "data-stub": "collaborative" });
const questions = [
    { question: "Can you attend?", question_type: "MC" },
    { question: "Why join?", question_type: "Text" },
];
const collaboration = { isConnected: true };
const currentUser = { id: "u1" };

// Build component props with test-specific overrides.
function props(overrides = {}) {
    return {
        questions,
        answers: { "Can you attend?": "Yes", "Why join?": "Draft" },
        // Provide an inert handle mcchange stub for this test.
        handleMCChange() {},
        // Provide an inert handle answer change stub for this test.
        handleAnswerChange() {},
        collaboration,
        currentUser,
        ...overrides,
    };
}

// Walk the rendered element tree to collect nodes for assertions.
function collect(node, elements = []) {
    if (Array.isArray(node)) {
        node.forEach(/* Invoke collect with the test inputs. */ (child) => collect(child, elements));
    } else if (React.isValidElement(node)) {
        elements.push(node);
        collect(node.props.children, elements);
    }
    return elements;
}

test("PIS question controls retain yes, no, text, and empty markup", async () => {
    // Verify PIS question controls retain yes, no, text, and empty markup.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const PisQuestionResponses = await loadTsxComponent(componentPath, {
        "../collaboration/CollaborativeTextarea": CollaborativeTextarea,
    });
    const scenarios = {
        yesText: props(),
        noEmpty: props({ answers: { "Can you attend?": "No" } }),
        none: props({ questions: [] }),
    };
    for (const [name, values] of Object.entries(scenarios)) {
        const html = renderToStaticMarkup(React.createElement(PisQuestionResponses, values));
        assert.equal(createHash("sha256").update(html).digest("hex"), expected[name]);
    }
});

test("multiple-choice changes and collaborative text props retain original routes", async () => {
    // Verify multiple-choice changes and collaborative text props retain original routes.
    const PisQuestionResponses = await loadTsxComponent(componentPath, {
        "../collaboration/CollaborativeTextarea": CollaborativeTextarea,
    });
    const calls = [];
    // Record on answer change calls for assertions.
    const onAnswerChange = (...args) => calls.push(["text", ...args]);
    const tree = PisQuestionResponses(props({
        // Record handle mcchange calls for assertions.
        handleMCChange: (question, answer) => calls.push(["mc", question, answer]),
        handleAnswerChange: onAnswerChange,
    }));
    const nodes = collect(tree);
    const radios = nodes.filter(/* Find the input with type radio. */ (node) => node.type === "input" && node.props.type === "radio");
    assert.deepEqual(radios.map(/* Return the fixture for this scenario. */ (node) => [
        node.props.name, node.props.value, node.props.checked,
    ]), [
        ["Can you attend?", "Yes", true],
        ["Can you attend?", "No", false],
    ]);
    radios[0].props.onChange({ target: { value: "Yes" } });
    radios[1].props.onChange({ target: { value: "No" } });

    const textarea = nodes.find(/* Match node.type to CollaborativeTextarea. */ (node) => node.type === CollaborativeTextarea);
    assert.equal(textarea.props.questionKey, "Why join?");
    assert.equal(textarea.props.value, "Draft");
    assert.equal(textarea.props.onChange, onAnswerChange);
    assert.equal(textarea.props.collaboration, collaboration);
    assert.equal(textarea.props.currentUser, currentUser);
    textarea.props.onChange("Why join?", "Updated", { source: "voice" });
    assert.deepEqual(calls, [
        ["mc", "Can you attend?", "Yes"],
        ["mc", "Can you attend?", "No"],
        ["text", "Why join?", "Updated", { source: "voice" }],
    ]);
});
