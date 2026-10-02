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

function props(overrides = {}) {
    return {
        question: "",
        setQuestion() {},
        questionType: "",
        setQuestionType() {},
        questionOrder: "",
        setQuestionOrder() {},
        questionCategory: "",
        setQuestionCategory() {},
        handleRequest() {},
        fetchPisQuestions() {},
        pisQuestions: [],
        pisQuestionsLoading: false,
        categoryEdits: {},
        setCategoryEdits() {},
        saveQuestionCategory() {},
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

test("PIS question card retains original empty, populated, and loading markup", async () => {
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
    const PisQuestionsCard = await loadTsxComponent(componentPath);
    const calls = [];
    const elements = collect(PisQuestionsCard(props({
        question: "Example question",
        questionType: "FR",
        questionOrder: "2",
        questionCategory: " Interview ",
        setQuestion: (value) => calls.push(["question", value]),
        setQuestionType: (value) => calls.push(["type", value]),
        setQuestionOrder: (value) => calls.push(["order", value]),
        setQuestionCategory: (value) => calls.push(["category", value]),
        handleRequest: async (endpoint, payload, method, message) => {
            calls.push(["request", endpoint, JSON.parse(JSON.stringify(payload)), method, message]);
        },
        fetchPisQuestions: () => calls.push(["fetch"]),
    })));
    const inputs = elements.filter((element) => element.type === "input");
    const input = (placeholder) => inputs.find((element) => element.props.placeholder === placeholder);
    const buttons = elements.filter((element) => element.type === "button");
    const button = (label) => buttons.find((element) => element.props.children === label);

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
    const PisQuestionsCard = await loadTsxComponent(componentPath);
    const question = { question: "Question 1", question_type: "FR", order: 2, category: "Interview" };
    const calls = [];
    const elements = collect(PisQuestionsCard(props({
        pisQuestions: [question],
        categoryEdits: { "Question 1": "Edited" },
        setCategoryEdits: (updater) => calls.push(["edit", JSON.parse(JSON.stringify(updater({ "Question 1": "Old" })))]),
        saveQuestionCategory: (value) => calls.push(["save", value]),
        fetchPisQuestions: () => calls.push(["fetch"]),
    })));
    const input = elements.find((element) => element.type === "input" && element.props.placeholder === "Fixed (no category)");
    const buttons = elements.filter((element) => element.type === "button");
    const button = (label) => buttons.find((element) => element.props.children === label);

    input.props.onChange({ target: { value: "New category" } });
    button("Save").props.onClick();
    button("Refresh").props.onClick();
    assert.deepEqual(calls, [
        ["edit", { "Question 1": "New category" }],
        ["save", question],
        ["fetch"],
    ]);
});
