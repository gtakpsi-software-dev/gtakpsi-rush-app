import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatRatingValue } from "../src/features/comments/ratingDisplay.js";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../src/features/rushee/zoom/ExistingCommentList.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("./fixtures/rusheeZoomExistingCommentList.json", import.meta.url));
const own = {
    brother_name: "Ari One", comment: "My note", night: { name: "Night 1" },
    ratings: [{ name: "Why AKPsi", value: 0 }, { name: "Professionalism", value: 4 }],
};
const other = {
    brother_name: "Bea Two", comment: "Other note", night: { name: "Night 2" },
    ratings: [{ name: "Why AKPsi", value: 3 }],
};
const Badges = () => React.createElement("span", { "data-stub": "badge" });
const CommentWarning = () => React.createElement("aside", { "data-stub": "warning" });
const FaEdit = () => React.createElement("i", { "data-stub": "edit" });
const FaTrash = () => React.createElement("i", { "data-stub": "trash" });

async function loadList() {
    return loadTsxComponent(componentPath, {
        "../../../components/Badge": Badges,
        "../../comments/CommentWarning": CommentWarning,
        "../../comments/ratingDisplay": { formatRatingValue },
        "react-icons/fa": { FaEdit, FaTrash },
    });
}

function props(overrides = {}) {
    return {
        visibleComments: [own, other],
        user: { firstname: "Ari", lastname: "One" },
        editingCommentId: null,
        editedCommentText: "Edited",
        setSelectedComment() {},
        handleEditComment() {},
        handleDeleteComment() {},
        setEditedCommentText() {},
        validateEditComment() {},
        editCommentWarnings: [{ type: "name", message: "Warning" }],
        setEditCommentWarnings() {},
        handleSubmitEdit() {},
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

test("existing comments retain viewing, editing, and empty markup", async () => {
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
    const ExistingCommentList = await loadList();
    const calls = [];
    const tree = ExistingCommentList(props({
        setSelectedComment: (comment) => calls.push(["select", comment]),
        handleEditComment: (comment) => calls.push(["edit", comment]),
        handleDeleteComment: (comment) => calls.push(["delete", comment]),
    }));
    const nodes = collect(tree);
    const cards = nodes.filter((node) => node.props.className?.includes("relative bg-apple-gray-50"));
    const buttons = nodes.filter((node) => node.type === "button");
    assert.equal(cards.length, 2);
    assert.equal(buttons.length, 4);
    cards[0].props.onClick();
    cards[1].props.onClick();
    buttons[0].props.onClick({ stopPropagation: () => calls.push(["stop"]) });
    buttons[1].props.onClick({ stopPropagation: () => calls.push(["stop"]) });
    assert.deepEqual(calls, [
        ["select", own], ["select", other],
        ["stop"], ["edit", own], ["stop"], ["delete", own],
    ]);
});

test("edit text, warning dismissal, and submit retain update order", async () => {
    const ExistingCommentList = await loadList();
    const calls = [];
    const tree = ExistingCommentList(props({
        editingCommentId: own.comment,
        setEditedCommentText: (text) => calls.push(["text", text]),
        validateEditComment: (text) => calls.push(["validate", text]),
        setEditCommentWarnings: (warnings) => calls.push(["warnings", warnings]),
        handleSubmitEdit: (comment) => calls.push(["submit", comment]),
    }));
    const nodes = collect(tree);
    const textarea = nodes.find((node) => node.type === "textarea");
    const warning = nodes.find((node) => node.type === CommentWarning);
    const update = nodes.find((node) => node.type === "button" && node.props.children === "Update Comment");
    textarea.props.onChange({ target: { value: "Revised" } });
    warning.props.onDismiss(0);
    update.props.onClick({ stopPropagation: () => calls.push(["stop"]) });
    assert.deepEqual(calls, [
        ["text", "Revised"], ["validate", "Revised"], ["warnings", []],
        ["stop"], ["submit", own],
    ]);
});
