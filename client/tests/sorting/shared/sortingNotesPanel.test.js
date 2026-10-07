import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TAGS } from "../../../src/features/sorting/board.js";
import { loadTsxComponent } from "../../helpers/loadTsxComponent.js";

const fixturePath = fileURLToPath(new URL("../../fixtures/sortingNotesPanel.json", import.meta.url));
const componentPath = fileURLToPath(new URL("../../../src/features/sorting/EditableNotesPanel.tsx", import.meta.url));

function loadPanel() {
    return loadTsxComponent(componentPath, { "./board": { TAGS } });
}

test("editable notes panel retains admin and bid committee markup in idle and loading states", async () => {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const EditableNotesPanel = await loadPanel();

    const rushee = {
        id: "id-42",
        fullName: "Ada Example",
        rushNumber: 42,
        sortingStatus: "IN_CLOUD",
    };

    for (const role of ["admin", "bidcom"]) {
        for (const status of ["idle", "loading"]) {
            const html = renderToStaticMarkup(React.createElement(EditableNotesPanel, {
                selectedRushee: rushee,
                audience: role,
                notesStatus: status,
                tags: ["night_1", "hard_no"],
                notes: "First line\nsecond line",
                onClose() {},
                onToggleTag() {},
                onNotesChange() {},
                onViewRushee() {},
            }));
            const hash = createHash("sha256").update(html).digest("hex");
            assert.equal(hash, expected[`${role}_${status}`], `${role} ${status} markup changed`);
            assert.equal(html.includes("Ada Example"), role === "admin");
        }
    }
});

test("notes panel keeps close, tag, text, and navigation handlers attached", async () => {
    const EditableNotesPanel = await loadPanel();
    const calls = [];
    const onClose = () => calls.push("close");
    const onToggleTag = (tag) => calls.push(tag);
    const onNotesChange = () => calls.push("text");
    const onViewRushee = () => calls.push("view");
    const tree = EditableNotesPanel({
        selectedRushee: { fullName: "Ada Example", rushNumber: 42, sortingStatus: "IN_CLOUD" },
        audience: "admin",
        notesStatus: "idle",
        tags: ["night_1"],
        notes: "First line",
        onClose,
        onToggleTag,
        onNotesChange,
        onViewRushee,
    });
    const elements = [];
    function collect(node) {
        if (Array.isArray(node)) {
            node.forEach(collect);
        } else if (React.isValidElement(node)) {
            elements.push(node);
            collect(node.props.children);
        }
    }
    collect(tree);

    const backdrop = elements.find((element) => element.props.className === "fixed inset-0 bg-black/20 z-10");
    const textarea = elements.find((element) => element.type === "textarea");
    const viewButton = elements.find((element) => element.type === "button" && element.props.children === "View Rushee Page");
    const closeButtons = elements.filter((element) => element.type === "button" &&
        (element.props.title === "Close" || element.props.children === "Close"));
    const firstTag = elements.find((element) => element.key === "night_1");

    assert.equal(backdrop.props.onClick, onClose);
    assert.equal(textarea.props.value, "First line");
    assert.equal(textarea.props.onChange, onNotesChange);
    assert.equal(viewButton.props.onClick, onViewRushee);
    assert.equal(closeButtons.length, 2);
    assert.ok(closeButtons.every((button) => button.props.onClick === onClose));
    firstTag.props.onClick();
    viewButton.props.onClick();
    closeButtons[0].props.onClick();
    assert.deepEqual(calls, ["night_1", "view", "close"]);
});
