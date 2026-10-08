import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TAGS } from "../../../src/features/sorting/board.js";
import { loadTsxComponent } from "../../helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../../../src/features/sorting/ViewerSortingColumn.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("../../fixtures/viewerSortingColumn.json", import.meta.url));
const first = { id: "r1", fullName: "Ada One", rushNumber: 12, sortingTags: ["night_1", "unknown"] };
const second = { id: "r2", fullName: "Bea Two", rushNumber: 13, sortingTags: [] };

// Build component props with test-specific overrides.
function props(overrides = {}) {
    return {
        col: { key: "UNSORTED", label: "Unsorted" },
        columns: { UNSORTED: [first, second] },
        showRusheeNames: true,
        // Provide an inert on open stub for this test.
        onOpen() {},
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

test("viewer columns retain brother and bid committee markup from before extraction", async () => {
    // Verify viewer columns retain brother and bid committee markup from before extraction.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const ViewerSortingColumn = await loadTsxComponent(componentPath, { "./board": { TAGS } });

    for (const [page, showRusheeNames] of [["BrotherSorting", true], ["BidCommitteeSorting", false]]) {
        for (const [scenario, cards] of [["empty", []], ["cards", [first, second]]]) {
            const html = renderToStaticMarkup(React.createElement(ViewerSortingColumn, props({
                columns: { UNSORTED: cards },
                showRusheeNames,
            })));
            const hash = createHash("sha256").update(html).digest("hex");
            assert.equal(hash, expected[`${page}_${scenario}`], `${page} ${scenario} changed`);
            if (scenario === "cards" && !showRusheeNames) {
                assert.match(html, /Rushee #12/);
                assert.doesNotMatch(html, /Ada One/);
            }
        }
    }
});

test("viewer cards pass their original row to the page's click handler", async () => {
    // Verify viewer cards pass their original row to the page's click handler.
    const ViewerSortingColumn = await loadTsxComponent(componentPath, { "./board": { TAGS } });
    const opened = [];
    const tree = ViewerSortingColumn(props({ onOpen: /* Record on open calls for assertions. */ (row) => opened.push(row) }));
    const cards = collect(tree).filter(/* Match node.props["data-card"]. */ (node) => node.props["data-card"]);

    assert.equal(cards.length, 2);
    cards[0].props.onClick();
    cards[1].props.onClick();
    assert.deepEqual(opened, [first, second]);
});
