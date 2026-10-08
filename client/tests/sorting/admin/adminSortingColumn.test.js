import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TAGS } from "../../../src/features/sorting/board.js";
import { loadTsxComponent } from "../../helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../../../src/features/sorting/SortingColumn.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("../../fixtures/adminSortingColumn.json", import.meta.url));
const col = { key: "UNSORTED", label: "Unsorted" };
const first = { id: "r1", fullName: "Ada One", rushNumber: 12, sortingTags: ["night_1", "unknown"] };
const second = { id: "r2", fullName: "Bea Two", rushNumber: 13, sortingTags: [] };

// Build component props with test-specific overrides.
function props(overrides = {}) {
    return {
        col,
        columns: { UNSORTED: [first, second] },
        hoverIndex: { column: null, index: null },
        dragging: null,
        draggingRef: { current: null },
        lockedCards: {},
        // Provide an inert set hover index stub for this test.
        setHoverIndex() {},
        // Provide an inert handle drag over stub for this test.
        handleDragOver() {},
        // Provide an inert handle drop stub for this test.
        handleDrop() {},
        // Provide an inert handle drag start stub for this test.
        handleDragStart() {},
        // Provide an inert handle drag end stub for this test.
        handleDragEnd() {},
        // Provide an inert open notes stub for this test.
        openNotes() {},
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

// Load column with injected dependencies for isolated tests.
async function loadColumn() {
    return loadTsxComponent(componentPath, { "./board": { TAGS } });
}

test("sorting column retains empty, locked, hovered, tagged, and trailing-drop markup", async () => {
    // Verify sorting column retains empty, locked, hovered, tagged, and trailing-drop markup.
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
    // Verify column and card drop handlers retain indices and event propagation.
    const SortingColumn = await loadColumn();
    const calls = [];
    // Record on drag end calls for assertions.
    const onDragEnd = () => calls.push(["end"]);
    const tree = SortingColumn(props({
        hoverIndex: { column: "UNSORTED", index: 1 },
        // Record set hover index calls for assertions.
        setHoverIndex: (hover) => calls.push(["hover", { column: hover.column, index: hover.index }]),
        // Record handle drag over calls for assertions.
        handleDragOver: (event, column, index) => calls.push(["over", event, column, index]),
        // Record handle drop calls for assertions.
        handleDrop: (column, index) => calls.push(["drop", column, index]),
        // Record handle drag start calls for assertions.
        handleDragStart: (card, column, index, event) => calls.push(["start", card, column, index, event]),
        handleDragEnd: onDragEnd,
        // Record open notes calls for assertions.
        openNotes: (card) => calls.push(["notes", card]),
    }));
    const nodes = collect(tree);
    const column = nodes[0];
    const cards = nodes.filter(
        /* Identify elements with the expected styling classes. */
        (node) => node.props.className?.startsWith("p-3 rounded-apple-lg"));
    const event = { id: "event" };
    column.props.onDragOver(event);
    column.props.onDrop();
    cards[0].props.onDragStart(event);
    assert.equal(cards[0].props.onDragEnd, onDragEnd);
    cards[0].props.onClick();
    cards[0].props.onDrop({ stopPropagation: /* Record stop propagation calls for assertions. */ () => calls.push(["stop"]) });
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
    // Verify card midpoint retains insertion positions and locked-card draggability.
    const SortingColumn = await loadColumn();
    const calls = [];
    const tree = SortingColumn(props({
        lockedCards: { r2: "Other Admin" },
        draggingRef: { current: { id: "r1" } },
        // Record set hover index calls for assertions.
        setHoverIndex: (hover) => calls.push(["hover", { column: hover.column, index: hover.index }]),
    }));
    const cards = collect(tree).filter(
        /* Identify elements with the expected styling classes. */
        (node) => node.props.className?.startsWith("p-3 rounded-apple-lg"));
    assert.deepEqual(cards.map(/* Read each card's draggable state. */ (card) => card.props.draggable), [true, false]);
    for (const clientY of [110, 130]) {
        cards[0].props.onDragOver({
            clientY,
            // Record prevent default calls for assertions.
            preventDefault: () => calls.push(["prevent"]),
            // Record stop propagation calls for assertions.
            stopPropagation: () => calls.push(["stop"]),
            currentTarget: { getBoundingClientRect:
                /* Return the bounding client rect fixture for this scenario. */
                () => ({ top: 100, height: 40 }) },
        });
    }
    assert.deepEqual(calls, [
        ["prevent"], ["stop"], ["hover", { column: "UNSORTED", index: 0 }],
        ["prevent"], ["stop"], ["hover", { column: "UNSORTED", index: 1 }],
    ]);
});
