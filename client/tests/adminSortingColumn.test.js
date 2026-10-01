import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TAGS } from "../src/features/sorting/board.js";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../src/features/sorting/SortingColumn.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("./fixtures/adminSortingColumn.json", import.meta.url));
const col = { key: "UNSORTED", label: "Unsorted" };
const first = { id: "r1", fullName: "Ada One", rushNumber: 12, sortingTags: ["night_1", "unknown"] };
const second = { id: "r2", fullName: "Bea Two", rushNumber: 13, sortingTags: [] };

function props(overrides = {}) {
    return {
        col,
        columns: { UNSORTED: [first, second] },
        hoverIndex: { column: null, index: null },
        dragging: null,
        draggingRef: { current: null },
        lockedCards: {},
        setHoverIndex() {},
        handleDragOver() {},
        handleDrop() {},
        handleDragStart() {},
        handleDragEnd() {},
        openNotes() {},
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

async function loadColumn() {
    return loadTsxComponent(componentPath, { "./board": { TAGS } });
}

test("sorting column retains empty, locked, hovered, tagged, and trailing-drop markup", async () => {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const SortingColumn = await loadColumn();
    const scenarios = {
        empty: props({ columns: { UNSORTED: [] } }),
        emptyHover: props({
            columns: { UNSORTED: [] },
            hoverIndex: { column: "UNSORTED", index: 0 },
            dragging: { id: "outside" },
        }),
        cards: props(),
        lockedHover: props({
            hoverIndex: { column: "UNSORTED", index: 0 },
            dragging: { id: "outside" },
            lockedCards: { r2: "Other Admin" },
            draggingRef: { current: { id: "r1" } },
        }),
        trailing: props({
            hoverIndex: { column: "UNSORTED", index: 2 },
            dragging: { id: "r1" },
            draggingRef: { current: { id: "r1" } },
        }),
    };
    for (const [name, values] of Object.entries(scenarios)) {
        const html = renderToStaticMarkup(React.createElement(SortingColumn, values));
        assert.equal(createHash("sha256").update(html).digest("hex"), expected[name]);
    }
});

test("column and card drop handlers retain indices and event propagation", async () => {
    const SortingColumn = await loadColumn();
    const calls = [];
    const onDragEnd = () => calls.push(["end"]);
    const tree = SortingColumn(props({
        hoverIndex: { column: "UNSORTED", index: 1 },
        setHoverIndex: (hover) => calls.push(["hover", { column: hover.column, index: hover.index }]),
        handleDragOver: (event, column, index) => calls.push(["over", event, column, index]),
        handleDrop: (column, index) => calls.push(["drop", column, index]),
        handleDragStart: (card, column, index, event) => calls.push(["start", card, column, index, event]),
        handleDragEnd: onDragEnd,
        openNotes: (card) => calls.push(["notes", card]),
    }));
    const nodes = collect(tree);
    const column = nodes[0];
    const cards = nodes.filter((node) => node.props.className?.startsWith("p-3 rounded-apple-lg"));
    const event = { id: "event" };
    column.props.onDragOver(event);
    column.props.onDrop();
    cards[0].props.onDragStart(event);
    assert.equal(cards[0].props.onDragEnd, onDragEnd);
    cards[0].props.onClick();
    cards[0].props.onDrop({ stopPropagation: () => calls.push(["stop"]) });
    column.props.onDragLeave();
    assert.deepEqual(calls, [
        ["over", event, "UNSORTED", 2],
        ["drop", "UNSORTED", 1],
        ["start", first, "UNSORTED", 0, event],
        ["notes", first],
        ["stop"], ["drop", "UNSORTED", 1],
        ["hover", { column: null, index: null }],
    ]);
});

test("card midpoint retains insertion positions and locked-card draggability", async () => {
    const SortingColumn = await loadColumn();
    const calls = [];
    const tree = SortingColumn(props({
        lockedCards: { r2: "Other Admin" },
        draggingRef: { current: { id: "r1" } },
        setHoverIndex: (hover) => calls.push(["hover", { column: hover.column, index: hover.index }]),
    }));
    const cards = collect(tree).filter((node) => node.props.className?.startsWith("p-3 rounded-apple-lg"));
    assert.deepEqual(cards.map((card) => card.props.draggable), [true, false]);
    for (const clientY of [110, 130]) {
        cards[0].props.onDragOver({
            clientY,
            preventDefault: () => calls.push(["prevent"]),
            stopPropagation: () => calls.push(["stop"]),
            currentTarget: { getBoundingClientRect: () => ({ top: 100, height: 40 }) },
        });
    }
    assert.deepEqual(calls, [
        ["prevent"], ["stop"], ["hover", { column: "UNSORTED", index: 0 }],
        ["prevent"], ["stop"], ["hover", { column: "UNSORTED", index: 1 }],
    ]);
});
