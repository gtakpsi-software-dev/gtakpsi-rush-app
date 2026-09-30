import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TAGS } from "../src/features/sorting/board.js";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const fixturePath = fileURLToPath(new URL("./fixtures/brotherDetailsPanel.json", import.meta.url));
const componentPath = fileURLToPath(new URL("../src/features/sorting/ReadOnlyDetailsPanel.tsx", import.meta.url));

function loadPanel() {
    return loadTsxComponent(componentPath, { "./board": { TAGS } });
}

test("read-only details panel retains original loading, populated, and empty markup", async () => {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const ReadOnlyDetailsPanel = await loadPanel();
    const selectedRushee = { fullName: "Ada Example", rushNumber: 42, sortingStatus: "IN_CLOUD" };
    const scenarios = {
        loading: { notesLoading: true, notesTags: ["night_1"], notes: "First line\nsecond line" },
        populated: { notesLoading: false, notesTags: ["night_1", "hard_no", "unknown"], notes: "First line\nsecond line" },
        empty: { notesLoading: false, notesTags: [], notes: "" },
    };

    for (const [scenario, values] of Object.entries(scenarios)) {
        const html = renderToStaticMarkup(React.createElement(ReadOnlyDetailsPanel, {
            selectedRushee,
            ...values,
            onClose() {},
            onViewRushee() {},
        }));
        const hash = createHash("sha256").update(html).digest("hex");
        assert.equal(hash, expected[scenario], `${scenario} markup changed`);
    }
});

test("read-only details panel keeps close and navigation handlers attached", async () => {
    const ReadOnlyDetailsPanel = await loadPanel();
    const calls = [];
    const onClose = () => calls.push("close");
    const onViewRushee = () => calls.push("view");
    const tree = ReadOnlyDetailsPanel({
        selectedRushee: { fullName: "Ada Example", sortingStatus: "IN_CLOUD" },
        notesLoading: false,
        notesTags: [],
        notes: "",
        onClose,
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
    const viewButton = elements.find((element) => element.type === "button" && element.props.children === "View Rushee Page");
    const closeButtons = elements.filter((element) => element.type === "button" &&
        (element.props.title === "Close" || element.props.children === "Close"));

    assert.equal(backdrop.props.onClick, onClose);
    assert.equal(viewButton.props.onClick, onViewRushee);
    assert.equal(closeButtons.length, 2);
    assert.ok(closeButtons.every((button) => button.props.onClick === onClose));
    viewButton.props.onClick();
    closeButtons[0].props.onClick();
    assert.deepEqual(calls, ["view", "close"]);
});
