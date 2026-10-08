import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../../helpers/loadTsxComponent.js";

const fixturePath = fileURLToPath(new URL("../../fixtures/sortingZoomControls.json", import.meta.url));
const componentPath = fileURLToPath(new URL("../../../src/features/sorting/SortingZoomControls.tsx", import.meta.url));

// Load controls with injected dependencies for isolated tests.
function loadControls() {
    return loadTsxComponent(componentPath);
}

test("all three sorting pages retain original zoom control markup and percentages", async () => {
    // Verify all three sorting pages retain original zoom control markup and percentages.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const SortingZoomControls = await loadControls();

    for (const page of ["AdminSorting.jsx", "BidCommitteeSorting.jsx", "BrotherSorting.jsx"]) {
        for (const scale of [1, 1.25]) {
            const html = renderToStaticMarkup(React.createElement(SortingZoomControls, {
                scale,
                // Provide an inert on zoom out stub for this test.
                onZoomOut() {},
                // Provide an inert on zoom in stub for this test.
                onZoomIn() {},
                // Provide an inert on reset view stub for this test.
                onResetView() {},
            }));
            const hash = createHash("sha256").update(html).digest("hex");
            assert.equal(hash, expected[`${page}_${scale}`], `${page} at ${scale} changed`);
        }
    }
});

test("zoom controls retain each button handler", async () => {
    // Verify zoom controls retain each button handler.
    const SortingZoomControls = await loadControls();
    const calls = [];
    const tree = SortingZoomControls({
        scale: 1.25,
        // Record on zoom out calls for assertions.
        onZoomOut: () => calls.push("out"),
        // Record on zoom in calls for assertions.
        onZoomIn: () => calls.push("in"),
        // Record on reset view calls for assertions.
        onResetView: () => calls.push("reset"),
    });
    const buttons = Array.from(tree.props.children).filter(
        /* Identify rendered button elements. */
        (child) => React.isValidElement(child) && child.type === "button");
    assert.deepEqual(buttons.map(/* Extract each zoom button's title. */ (button) => button.props.title), ["Zoom out", "Zoom in", "Reset view"]);
    buttons.forEach(/* Invoke button.props.onClick with the test inputs. */ (button) => button.props.onClick());
    assert.deepEqual(calls, ["out", "in", "reset"]);
});
