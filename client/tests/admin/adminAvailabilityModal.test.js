import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const fixturePath = fileURLToPath(new URL("../fixtures/adminAvailabilityModal.json", import.meta.url));
const componentPath = fileURLToPath(new URL("../../src/features/admin/availability/AvailabilityEditorModal.tsx", import.meta.url));
const slot = { time: { $date: { $numberLong: "1790784000000" } } };
const slotIso = new Date(Number(slot.time.$date.$numberLong)).toISOString();

// Build component props with test-specific overrides.
function props(overrides = {}) {
    return {
        editingBrotherAvailability: { brother_first_name: "Ada", brother_last_name: "Example" },
        allPisTimeslots: [],
        groupedEditSlots: {},
        editingSlots: new Set(),
        savingAvailability: false,
        // Return the format slot time fixture for this scenario.
        formatSlotTime: () => ({ date: "Date label", time: "3:30 PM" }),
        // Provide an inert on close stub for this test.
        onClose() {},
        // Provide an inert on select all stub for this test.
        onSelectAll() {},
        // Provide an inert on clear all stub for this test.
        onClearAll() {},
        // Provide an inert on toggle slot stub for this test.
        onToggleSlot() {},
        // Provide an inert on save stub for this test.
        onSave() {},
        ...overrides,
    };
}

test("availability modal retains original empty, selected, and saving markup", async () => {
    // Verify availability modal retains original empty, selected, and saving markup.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const AvailabilityEditorModal = await loadTsxComponent(componentPath);
    const scenarios = {
        empty: {},
        slots: { allPisTimeslots: [slot], groupedEditSlots: { "Date label": [slot] }, editingSlots: new Set([slotIso]) },
        saving: { allPisTimeslots: [slot], groupedEditSlots: { "Date label": [slot] }, savingAvailability: true },
    };

    for (const [scenario, values] of Object.entries(scenarios)) {
        const html = renderToStaticMarkup(React.createElement(AvailabilityEditorModal, props(values)));
        const hash = createHash("sha256").update(html).digest("hex");
        assert.equal(hash, expected[scenario], `${scenario} markup changed`);
    }
});

test("availability modal keeps its close, slot, bulk selection, and save handlers", async () => {
    // Verify availability modal keeps its close, slot, bulk selection, and save handlers.
    const AvailabilityEditorModal = await loadTsxComponent(componentPath);
    const calls = [];
    const tree = AvailabilityEditorModal(props({
        allPisTimeslots: [slot],
        groupedEditSlots: { "Date label": [slot] },
        // Record on close calls for assertions.
        onClose: () => calls.push("close"),
        // Record on select all calls for assertions.
        onSelectAll: () => calls.push("select"),
        // Record on clear all calls for assertions.
        onClearAll: () => calls.push("clear"),
        // Record on toggle slot calls for assertions.
        onToggleSlot: (value) => calls.push(value),
        // Record on save calls for assertions.
        onSave: () => calls.push("save"),
    }));
    const elements = [];
    // Walk the rendered element tree to collect nodes for assertions.
    function collect(node) {
        if (Array.isArray(node)) {
            node.forEach(collect);
        } else if (React.isValidElement(node)) {
            elements.push(node);
            collect(node.props.children);
        }
    }
    collect(tree);

    const backdrop = elements.find(
        /* Identify elements with the expected styling classes. */
        (element) => element.props.className === "absolute inset-0 bg-black/50 backdrop-blur-sm");
    const buttons = elements.filter(/* Identify rendered button elements. */ (element) => element.type === "button");
    // Invoke buttons.find with the test inputs.
    const button = (label) => buttons.find(/* Match the control by its displayed label. */ (element) => element.props.children === label);

    assert.equal(typeof backdrop.props.onClick, "function");
    backdrop.props.onClick();
    button("Select All").props.onClick();
    button("Clear All").props.onClick();
    button("3:30 PM").props.onClick();
    button("Cancel").props.onClick();
    button("Save (0 slots)").props.onClick();
    assert.deepEqual(calls, ["close", "select", "clear", slotIso, "close", "save"]);
});
