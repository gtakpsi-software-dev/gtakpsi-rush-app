import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatRatingValue } from "../../../src/features/comments/ratingDisplay.js";
import { loadTsxComponent } from "../../helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../../../src/features/rushee/zoom/ExistingCommentList.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("../../fixtures/rusheeZoomExistingCommentList.json", import.meta.url));
const own = {
    brother_name: "Ari One", comment: "My note", night: { name: "Night 1" },
    ratings: [{ name: "Why AKPsi", value: 0 }, { name: "Professionalism", value: 4 }],
};
const other = {
    brother_name: "Bea Two", comment: "Other note", night: { name: "Night 2" },
    ratings: [{ name: "Why AKPsi", value: 3 }],
};
// Render a lightweight React element for component assertions.
const Badges = () => React.createElement("span", { "data-stub": "badge" });
// Render a lightweight React element for component assertions.
const CommentWarning = () => React.createElement("aside", { "data-stub": "warning" });
// Render a lightweight React element for component assertions.
const FaEdit = () => React.createElement("i", { "data-stub": "edit" });
// Render a lightweight React element for component assertions.
const FaTrash = () => React.createElement("i", { "data-stub": "trash" });

// Load list with injected dependencies for isolated tests.
async function loadList() {
    return loadTsxComponent(componentPath, {
        "../../../components/Badge": Badges,
        "../../comments/CommentWarning": CommentWarning,
        "../../comments/ratingDisplay": { formatRatingValue },
        "react-icons/fa": { FaEdit, FaTrash },
    });
}

// Build component props with test-specific overrides.
function props(overrides = {}) {
    return {
        visibleComments: [own, other],
        user: { firstname: "Ari", lastname: "One" },
        editingCommentId: null,
        editedCommentText: "Edited",
        // Provide an inert set selected comment stub for this test.
        setSelectedComment() {},
        // Provide an inert handle edit comment stub for this test.
        handleEditComment() {},
        // Provide an inert handle delete comment stub for this test.
        handleDeleteComment() {},
        // Provide an inert set edited comment text stub for this test.
        setEditedCommentText() {},
        // Provide an inert validate edit comment stub for this test.
        validateEditComment() {},
        editCommentWarnings: [{ type: "name", message: "Warning" }],
        // Provide an inert set edit comment warnings stub for this test.
        setEditCommentWarnings() {},
        // Provide an inert handle submit edit stub for this test.
        handleSubmitEdit() {},
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

test("existing comments retain viewing, editing, and empty markup", async () => {
    // Verify existing comments retain viewing, editing, and empty markup.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const ExistingCommentList = await loadList();
    const scenarios = {
        viewing: props(),
        editing: props({ editingCommentId: own.comment }),
        empty: props({ visibleComments: [] }),
    };
    for (const [name, values] of Object.entries(scenarios)) {
        const html = renderToStaticMarkup(React.createElement(ExistingCommentList, values));
        assert.equal(createHash("sha256").update(html).digest("hex"), expected[name]);
    }
});

test("comment cards and edit/delete buttons retain their handlers and propagation", async () => {
    // Verify comment cards and edit/delete buttons retain their handlers and propagation.
    const ExistingCommentList = await loadList();
    const calls = [];
    const tree = ExistingCommentList(props({
        // Record set selected comment calls for assertions.
        setSelectedComment: (comment) => calls.push(["select", comment]),
        // Record handle edit comment calls for assertions.
        handleEditComment: (comment) => calls.push(["edit", comment]),
        // Record handle delete comment calls for assertions.
        handleDeleteComment: (comment) => calls.push(["delete", comment]),
    }));
    const nodes = collect(tree);
    const cards = nodes.filter(
        /* Identify elements with the expected styling classes. */
        (node) => node.props.className?.includes("relative bg-apple-gray-50"));
    const buttons = nodes.filter(/* Identify rendered button elements. */ (node) => node.type === "button");
    assert.equal(cards.length, 2);
    assert.equal(buttons.length, 4);
    cards[0].props.onClick();
    cards[1].props.onClick();
    buttons[0].props.onClick({ stopPropagation: /* Record stop propagation calls for assertions. */ () => calls.push(["stop"]) });
    buttons[1].props.onClick({ stopPropagation: /* Record stop propagation calls for assertions. */ () => calls.push(["stop"]) });
    assert.deepEqual(calls, [
        ["select", own], ["select", other],
        ["stop"], ["edit", own], ["stop"], ["delete", own],
    ]);
});

test("edit text, warning dismissal, and submit retain update order", async () => {
    // Verify edit text, warning dismissal, and submit retain update order.
    const ExistingCommentList = await loadList();
    const calls = [];
    const tree = ExistingCommentList(props({
        editingCommentId: own.comment,
        // Record set edited comment text calls for assertions.
        setEditedCommentText: (text) => calls.push(["text", text]),
        // Record validate edit comment calls for assertions.
        validateEditComment: (text) => calls.push(["validate", text]),
        // Record set edit comment warnings calls for assertions.
        setEditCommentWarnings: (warnings) => calls.push(["warnings", warnings]),
        // Record handle submit edit calls for assertions.
        handleSubmitEdit: (comment) => calls.push(["submit", comment]),
    }));
    const nodes = collect(tree);
    const textarea = nodes.find(/* Identify rendered textarea elements. */ (node) => node.type === "textarea");
    const warning = nodes.find(/* Match node.type to CommentWarning. */ (node) => node.type === CommentWarning);
    const update = nodes.find(
        /* Find the button with label Update Comment. */
        (node) => node.type === "button" && node.props.children === "Update Comment");
    textarea.props.onChange({ target: { value: "Revised" } });
    warning.props.onDismiss(0);
    update.props.onClick({ stopPropagation: /* Record stop propagation calls for assertions. */ () => calls.push(["stop"]) });
    assert.deepEqual(calls, [
        ["text", "Revised"], ["validate", "Revised"], ["warnings", []],
        ["stop"], ["submit", own],
    ]);
});
