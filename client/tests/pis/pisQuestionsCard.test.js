import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const fixturePath = fileURLToPath(new URL("../fixtures/pisQuestionsCard.json", import.meta.url));
const componentPath = fileURLToPath(new URL("../../src/features/admin/pis/PisQuestionsCard.tsx", import.meta.url));

// Build component props with test-specific overrides.
function props(overrides = {}) {
    return {
        question: "",
        // Provide an inert set question stub for this test.
        setQuestion() {},
        questionType: "",
        // Provide an inert set question type stub for this test.
        setQuestionType() {},
        questionOrder: "",
        // Provide an inert set question order stub for this test.
        setQuestionOrder() {},
        questionCategory: "",
        // Provide an inert set question category stub for this test.
        setQuestionCategory() {},
        // Provide an inert handle request stub for this test.
        handleRequest() {},
        // Provide an inert fetch pis questions stub for this test.
        fetchPisQuestions() {},
        pisQuestions: [],
        pisQuestionsLoading: false,
        categoryEdits: {},
        // Provide an inert set category edits stub for this test.
        setCategoryEdits() {},
        // Provide an inert save question category stub for this test.
        saveQuestionCategory() {},
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

test("PIS question card retains original empty, populated, and loading markup", async () => {
    // Verify PIS question card retains original empty, populated, and loading markup.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const PisQuestionsCard = await loadTsxComponent(componentPath);
    const scenarios = {
        empty: {},
        populated: {
            question: "Example question",
            questionType: "FR",
            questionOrder: 2,
            questionCategory: "Interview",
            pisQuestions: [
                { question: "Question 1", question_type: "FR", order: 2, category: "Interview" },
                { question: "Question 2", question_type: "MC", order: null, category: null },
            ],
            categoryEdits: { "Question 1": "Edited" },
        },
        loading: { pisQuestionsLoading: true },
    };

    for (const [scenario, values] of Object.entries(scenarios)) {
        const html = renderToStaticMarkup(React.createElement(PisQuestionsCard, props(values)));
        const hash = createHash("sha256").update(html).digest("hex");
        assert.equal(hash, expected[scenario], `${scenario} markup changed`);
    }
});

test("PIS question form preserves input conversion and add/delete request order", async () => {
    // Verify PIS question form preserves input conversion and add/delete request order.
    const PisQuestionsCard = await loadTsxComponent(componentPath);
    const calls = [];
    const elements = collect(PisQuestionsCard(props({
        question: "Example question",
        questionType: "FR",
        questionOrder: "2",
        questionCategory: " Interview ",
        // Record set question calls for assertions.
        setQuestion: (value) => calls.push(["question", value]),
        // Record set question type calls for assertions.
        setQuestionType: (value) => calls.push(["type", value]),
        // Record set question order calls for assertions.
        setQuestionOrder: (value) => calls.push(["order", value]),
        // Record set question category calls for assertions.
        setQuestionCategory: (value) => calls.push(["category", value]),
        // Record handle request calls for assertions.
        handleRequest: async (endpoint, payload, method, message) => {
            calls.push(["request", endpoint, JSON.parse(JSON.stringify(payload)), method, message]);
        },
        // Record fetch pis questions calls for assertions.
        fetchPisQuestions: () => calls.push(["fetch"]),
    })));
    const inputs = elements.filter(/* Identify rendered input elements. */ (element) => element.type === "input");
    // Invoke inputs.find with the test inputs.
    const input = (placeholder) => inputs.find(
        /* Match element.props.placeholder to placeholder. */
        (element) => element.props.placeholder === placeholder);
    const buttons = elements.filter(/* Identify rendered button elements. */ (element) => element.type === "button");
    // Invoke buttons.find with the test inputs.
    const button = (label) => buttons.find(/* Match the control by its displayed label. */ (element) => element.props.children === label);

    input("Question text").props.onChange({ target: { value: "New question" } });
    input("Question type (e.g., FR, MC)").props.onChange({ target: { value: "MC" } });
    input("Question order (e.g., 1)").props.onChange({ target: { value: "3" } });
    input("Question order (e.g., 1)").props.onChange({ target: { value: "" } });
    input("Category (leave blank for a fixed, always-shown question)").props.onChange({ target: { value: "Other" } });
    await button("Add Question").props.onClick();
    await button("Delete Question").props.onClick();

    assert.deepEqual(calls, [
        ["question", "New question"], ["type", "MC"], ["order", 3], ["order", ""], ["category", "Other"],
        ["request", "add_pis_question", { question: "Example question", question_type: "FR", order: 2, category: "Interview" }, "post", "Question added!"],
        ["fetch"],
        ["request", "delete_pis_question", { question: "Example question", question_type: "FR" }, "post", "Question deleted!"],
        ["fetch"],
    ]);
});

test("PIS question bank preserves category draft and save handlers", async () => {
    // Verify PIS question bank preserves category draft and save handlers.
    const PisQuestionsCard = await loadTsxComponent(componentPath);
    const question = { question: "Question 1", question_type: "FR", order: 2, category: "Interview" };
    const calls = [];
    const elements = collect(PisQuestionsCard(props({
        pisQuestions: [question],
        categoryEdits: { "Question 1": "Edited" },
        // Record set category edits calls for assertions.
        setCategoryEdits: (updater) => calls.push(["edit", JSON.parse(JSON.stringify(updater({ "Question 1": "Old" })))]),
        // Record save question category calls for assertions.
        saveQuestionCategory: (value) => calls.push(["save", value]),
        // Record fetch pis questions calls for assertions.
        fetchPisQuestions: () => calls.push(["fetch"]),
    })));
    const input = elements.find(
        /* Find the input with placeholder Fixed (no category). */
        (element) => element.type === "input" && element.props.placeholder === "Fixed (no category)");
    const buttons = elements.filter(/* Identify rendered button elements. */ (element) => element.type === "button");
    // Invoke buttons.find with the test inputs.
    const button = (label) => buttons.find(/* Match the control by its displayed label. */ (element) => element.props.children === label);

    input.props.onChange({ target: { value: "New category" } });
    button("Save").props.onClick();
    button("Refresh").props.onClick();
    assert.deepEqual(calls, [
        ["edit", { "Question 1": "New category" }],
        ["save", question],
        ["fetch"],
    ]);
});
