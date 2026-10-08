import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../../helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../../../src/features/rushee/zoom/NewCommentForm.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("../../fixtures/rusheeZoomNewCommentForm.json", import.meta.url));
// Render a lightweight React element for component assertions.
const CommentWarning = () => React.createElement("aside", { "data-stub": "warning" });
// Render a lightweight React element for component assertions.
const RatingSlider = () => React.createElement("section", { "data-stub": "rating" });

// Build component props with test-specific overrides.
function props(overrides = {}) {
    return {
        isAddingComment: false,
        // Provide an inert handle add comment stub for this test.
        handleAddComment() {},
        newComment: "Draft",
        // Provide an inert set new comment stub for this test.
        setNewComment() {},
        // Provide an inert validate new comment stub for this test.
        validateNewComment() {},
        commentWarnings: [{ type: "name", message: "Name" }],
        // Provide an inert set comment warnings stub for this test.
        setCommentWarnings() {},
        ratingFields: ["Why AKPsi", "Professionalism"],
        ratings: { "Why AKPsi": 3, Professionalism: 4 },
        ratingNotSeen: { "Why AKPsi": true, Professionalism: false },
        // Provide an inert handle rating change stub for this test.
        handleRatingChange() {},
        // Provide an inert handle rating not seen change stub for this test.
        handleRatingNotSeenChange() {},
        // Provide an inert handle submit comment stub for this test.
        handleSubmitComment() {},
        ...overrides,
    };
}

// Load form with injected dependencies for isolated tests.
async function loadForm() {
    return loadTsxComponent(componentPath, {
        "../../comments/CommentWarning": CommentWarning,
        "./RatingSlider": RatingSlider,
    });
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

test("new-comment form retains collapsed and expanded markup", async () => {
    // Verify new-comment form retains collapsed and expanded markup.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const NewCommentForm = await loadForm();
    for (const [name, isAddingComment] of Object.entries({ collapsed: false, expanded: true })) {
        const html = renderToStaticMarkup(React.createElement(NewCommentForm, props({ isAddingComment })));
        assert.equal(createHash("sha256").update(html).digest("hex"), expected[name]);
    }
});

test("add action and draft validation preserve their call order", async () => {
    // Verify add action and draft validation preserve their call order.
    const NewCommentForm = await loadForm();
    const calls = [];
    const collapsed = collect(NewCommentForm(props({
        // Record handle add comment calls for assertions.
        handleAddComment: () => calls.push(["add"]),
    })));
    collapsed.find(
        /* Identify elements with the expected styling classes. */
        (node) => node.props.className?.includes("border-2 border-dashed")).props.onClick();

    const expanded = collect(NewCommentForm(props({
        isAddingComment: true,
        // Record set new comment calls for assertions.
        setNewComment: (text) => calls.push(["text", text]),
        // Record validate new comment calls for assertions.
        validateNewComment: (text) => calls.push(["validate", text]),
    })));
    expanded.find(/* Identify rendered textarea elements. */ (node) => node.type === "textarea").props.onChange({ target: { value: "New draft" } });
    assert.deepEqual(calls, [["add"], ["text", "New draft"], ["validate", "New draft"]]);
});

test("warnings, ratings, and submit preserve exact callbacks", async () => {
    // Verify warnings, ratings, and submit preserve exact callbacks.
    const NewCommentForm = await loadForm();
    const calls = [];
    const nodes = collect(NewCommentForm(props({
        isAddingComment: true,
        // Record set comment warnings calls for assertions.
        setCommentWarnings: (warnings) => calls.push(["warnings", warnings]),
        // Record handle rating change calls for assertions.
        handleRatingChange: (field, value) => calls.push(["value", field, value]),
        // Record handle rating not seen change calls for assertions.
        handleRatingNotSeenChange: (field, value) => calls.push(["notSeen", field, value]),
        // Record handle submit comment calls for assertions.
        handleSubmitComment: () => calls.push(["submit"]),
    })));
    nodes.find(/* Match node.type to CommentWarning. */ (node) => node.type === CommentWarning).props.onDismiss(0);
    const sliders = nodes.filter(/* Match node.type to RatingSlider. */ (node) => node.type === RatingSlider);
    assert.deepEqual(sliders.map(/* Return the fixture for this scenario. */ (node) => [node.props.label, node.props.value, node.props.notSeen]), [
        ["Why AKPsi", 3, true], ["Professionalism", 4, false],
    ]);
    sliders[0].props.onValueChange(5);
    sliders[1].props.onNotSeenChange(true);
    nodes.find(/* Identify rendered button elements. */ (node) => node.type === "button").props.onClick();
    assert.deepEqual(calls, [
        ["warnings", []], ["value", "Why AKPsi", 5],
        ["notSeen", "Professionalism", true], ["submit"],
    ]);
});
