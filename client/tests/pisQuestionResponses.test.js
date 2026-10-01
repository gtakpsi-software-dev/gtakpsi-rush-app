import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../src/features/pis/PisQuestionResponses.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("./fixtures/pisQuestionResponses.json", import.meta.url));
const CollaborativeTextarea = () => React.createElement("textarea", { "data-stub": "collaborative" });
const questions = [
    { question: "Can you attend?", question_type: "MC" },
    { question: "Why join?", question_type: "Text" },
];
const collaboration = { isConnected: true };
const currentUser = { id: "u1" };

function props(overrides = {}) {
    return {
        questions,
        answers: { "Can you attend?": "Yes", "Why join?": "Draft" },
        handleMCChange() {},
        handleAnswerChange() {},
        collaboration,
        currentUser,
        ...overrides,
    };
}

function collect(node, elements = []) {
    if (Array.isArray(node)) {
        node.forEach((child) => collect(child, elements));
    } else if (React.isValidElement(node)) {
        elements.push(node);
        collect(node.props.children, elements);
    }
    return elements;
}

test("PIS question controls retain yes, no, text, and empty markup", async () => {
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
    const PisQuestionResponses = await loadTsxComponent(componentPath, {
        "../collaboration/CollaborativeTextarea": CollaborativeTextarea,
    });
    const calls = [];
    const onAnswerChange = (...args) => calls.push(["text", ...args]);
    const tree = PisQuestionResponses(props({
        handleMCChange: (question, answer) => calls.push(["mc", question, answer]),
        handleAnswerChange: onAnswerChange,
    }));
    const nodes = collect(tree);
    const radios = nodes.filter((node) => node.type === "input" && node.props.type === "radio");
    assert.deepEqual(radios.map((node) => [
        node.props.name, node.props.value, node.props.checked,
    ]), [
        ["Can you attend?", "Yes", true],
        ["Can you attend?", "No", false],
    ]);
    radios[0].props.onChange({ target: { value: "Yes" } });
    radios[1].props.onChange({ target: { value: "No" } });

    const textarea = nodes.find((node) => node.type === CollaborativeTextarea);
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
