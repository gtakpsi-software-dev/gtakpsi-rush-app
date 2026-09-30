import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const fixturePath = fileURLToPath(new URL("./fixtures/adminAvailabilityModal.json", import.meta.url));
const componentPath = fileURLToPath(new URL("../src/features/admin/availability/AvailabilityEditorModal.tsx", import.meta.url));
const slot = { time: { $date: { $numberLong: "1790784000000" } } };
const slotIso = new Date(Number(slot.time.$date.$numberLong)).toISOString();

function props(overrides = {}) {
    return {
        editingBrotherAvailability: { brother_first_name: "Ada", brother_last_name: "Example" },
        allPisTimeslots: [],
        groupedEditSlots: {},
        editingSlots: new Set(),
        savingAvailability: false,
        formatSlotTime: () => ({ date: "Date label", time: "3:30 PM" }),
        onClose() {},
        onSelectAll() {},
        onClearAll() {},
        onToggleSlot() {},
        onSave() {},
        ...overrides,
    };
}

test("availability modal retains original empty, selected, and saving markup", async () => {
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
    const AvailabilityEditorModal = await loadTsxComponent(componentPath);
    const calls = [];
    const tree = AvailabilityEditorModal(props({
        allPisTimeslots: [slot],
        groupedEditSlots: { "Date label": [slot] },
        onClose: () => calls.push("close"),
        onSelectAll: () => calls.push("select"),
        onClearAll: () => calls.push("clear"),
        onToggleSlot: (value) => calls.push(value),
        onSave: () => calls.push("save"),
    }));
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

    const backdrop = elements.find((element) => element.props.className === "absolute inset-0 bg-black/50 backdrop-blur-sm");
    const buttons = elements.filter((element) => element.type === "button");
    const button = (label) => buttons.find((element) => element.props.children === label);

    assert.equal(typeof backdrop.props.onClick, "function");
    backdrop.props.onClick();
    button("Select All").props.onClick();
    button("Clear All").props.onClick();
    button("3:30 PM").props.onClick();
    button("Cancel").props.onClick();
    button("Save (0 slots)").props.onClick();
    assert.deepEqual(calls, ["close", "select", "clear", slotIso, "close", "save"]);
});
