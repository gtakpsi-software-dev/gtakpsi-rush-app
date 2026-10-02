import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const fixturePath = fileURLToPath(new URL("./fixtures/sortingZoomControls.json", import.meta.url));
const componentPath = fileURLToPath(new URL("../src/features/sorting/SortingZoomControls.tsx", import.meta.url));

function loadControls() {
    return loadTsxComponent(componentPath);
}

test("all three sorting pages retain original zoom control markup and percentages", async () => {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const SortingZoomControls = await loadControls();

    for (const page of ["AdminSorting.jsx", "BidCommitteeSorting.jsx", "BrotherSorting.jsx"]) {
        for (const scale of [1, 1.25]) {
            const html = renderToStaticMarkup(React.createElement(SortingZoomControls, {
                scale,
                onZoomOut() {},
                onZoomIn() {},
                onResetView() {},
            }));
            const hash = createHash("sha256").update(html).digest("hex");
            assert.equal(hash, expected[`${page}_${scale}`], `${page} at ${scale} changed`);
        }
    }
});

test("zoom controls retain each button handler", async () => {
    const SortingZoomControls = await loadControls();
    const calls = [];
    const tree = SortingZoomControls({
        scale: 1.25,
        onZoomOut: () => calls.push("out"),
        onZoomIn: () => calls.push("in"),
        onResetView: () => calls.push("reset"),
    });
    const buttons = Array.from(tree.props.children).filter((child) => React.isValidElement(child) && child.type === "button");
    assert.deepEqual(buttons.map((button) => button.props.title), ["Zoom out", "Zoom in", "Reset view"]);
    buttons.forEach((button) => button.props.onClick());
    assert.deepEqual(calls, ["out", "in", "reset"]);
});
