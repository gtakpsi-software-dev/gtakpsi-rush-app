import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../src/features/rushee/zoom/NewCommentForm.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("./fixtures/rusheeZoomNewCommentForm.json", import.meta.url));
const CommentWarning = () => React.createElement("aside", { "data-stub": "warning" });
const RatingSlider = () => React.createElement("section", { "data-stub": "rating" });

function props(overrides = {}) {
    return {
        isAddingComment: false,
        handleAddComment() {},
        newComment: "Draft",
        setNewComment() {},
        validateNewComment() {},
        commentWarnings: [{ type: "name", message: "Name" }],
        setCommentWarnings() {},
        ratingFields: ["Why AKPsi", "Professionalism"],
        ratings: { "Why AKPsi": 3, Professionalism: 4 },
        ratingNotSeen: { "Why AKPsi": true, Professionalism: false },
        handleRatingChange() {},
        handleRatingNotSeenChange() {},
        handleSubmitComment() {},
        ...overrides,
    };
}

async function loadForm() {
    return loadTsxComponent(componentPath, {
        "../../comments/CommentWarning": CommentWarning,
        "../../../components/RatingSlider": RatingSlider,
    });
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

test("new-comment form retains collapsed and expanded markup", async () => {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const NewCommentForm = await loadForm();
    for (const [name, isAddingComment] of Object.entries({ collapsed: false, expanded: true })) {
        const html = renderToStaticMarkup(React.createElement(NewCommentForm, props({ isAddingComment })));
        assert.equal(createHash("sha256").update(html).digest("hex"), expected[name]);
    }
});

test("add action and draft validation preserve their call order", async () => {
    const NewCommentForm = await loadForm();
    const calls = [];
    const collapsed = collect(NewCommentForm(props({
        handleAddComment: () => calls.push(["add"]),
    })));
    collapsed.find((node) => node.props.className?.includes("border-2 border-dashed")).props.onClick();

    const expanded = collect(NewCommentForm(props({
        isAddingComment: true,
        setNewComment: (text) => calls.push(["text", text]),
        validateNewComment: (text) => calls.push(["validate", text]),
    })));
    expanded.find((node) => node.type === "textarea").props.onChange({ target: { value: "New draft" } });
    assert.deepEqual(calls, [["add"], ["text", "New draft"], ["validate", "New draft"]]);
});

test("warnings, ratings, and submit preserve exact callbacks", async () => {
    const NewCommentForm = await loadForm();
    const calls = [];
    const nodes = collect(NewCommentForm(props({
        isAddingComment: true,
        setCommentWarnings: (warnings) => calls.push(["warnings", warnings]),
        handleRatingChange: (field, value) => calls.push(["value", field, value]),
        handleRatingNotSeenChange: (field, value) => calls.push(["notSeen", field, value]),
        handleSubmitComment: () => calls.push(["submit"]),
    })));
    nodes.find((node) => node.type === CommentWarning).props.onDismiss(0);
    const sliders = nodes.filter((node) => node.type === RatingSlider);
    assert.deepEqual(sliders.map((node) => [node.props.label, node.props.value, node.props.notSeen]), [
        ["Why AKPsi", 3, true], ["Professionalism", 4, false],
    ]);
    sliders[0].props.onValueChange(5);
    sliders[1].props.onNotSeenChange(true);
    nodes.find((node) => node.type === "button").props.onClick();
    assert.deepEqual(calls, [
        ["warnings", []], ["value", "Why AKPsi", 5],
        ["notSeen", "Professionalism", true], ["submit"],
    ]);
});
