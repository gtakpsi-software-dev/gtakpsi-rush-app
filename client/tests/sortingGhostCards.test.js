import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const fixturePath = fileURLToPath(new URL("./fixtures/sortingGhostCards.json", import.meta.url));
const componentPath = fileURLToPath(new URL("../src/features/sorting/SortingGhostCards.tsx", import.meta.url));

function loadGhostCards() {
    return loadTsxComponent(componentPath);
}

test("all sorting boards retain ghost card positions, names, and widths", async () => {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const SortingGhostCards = await loadGhostCards();
    const scenarios = {
        empty: {},
        single: { a: { rusheeId: "a", rusheeName: "Ada Example", draggerName: "Alex", x: 30, y: 50 } },
        multiple: {
            a: { rusheeId: "a", rusheeName: "Ada Example", draggerName: "Alex", x: 30, y: 50 },
            b: { rusheeId: "b", rusheeName: "Bea Example", draggerName: "Blair", x: 80, y: 90 },
        },
    };

    for (const page of ["AdminSorting.jsx", "BidCommitteeSorting.jsx", "BrotherSorting.jsx"]) {
        for (const [scenario, ghostCards] of Object.entries(scenarios)) {
            const html = renderToStaticMarkup(React.createElement(SortingGhostCards, {
                ghostCards,
                wide: page === "AdminSorting.jsx",
            }));
            const hash = createHash("sha256").update(html).digest("hex");
            assert.equal(hash, expected[`${page}_${scenario}`], `${page} ${scenario} changed`);
        }
    }
});
