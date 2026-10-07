import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../../helpers/loadTsxComponent.js";

const fixturePath = fileURLToPath(new URL("../../fixtures/sortingPresenceIndicator.json", import.meta.url));
const componentPath = fileURLToPath(new URL("../../../src/features/sorting/SortingPresenceIndicator.tsx", import.meta.url));

function loadIndicator() {
    return loadTsxComponent(componentPath);
}

test("sorting presence badge retains each role's visibility, labels, and styling", async () => {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const SortingPresenceIndicator = await loadIndicator();
    const scenarios = {
        disconnected: { connected: false, viewerCount: 2, ghostCards: {} },
        alone: { connected: true, viewerCount: 1, ghostCards: {} },
        viewers: { connected: true, viewerCount: 3, ghostCards: {} },
        single: { connected: true, viewerCount: 3, ghostCards: { a: { draggerName: "Alex" } } },
        multiple: { connected: true, viewerCount: 3, ghostCards: { a: { draggerName: "Alex" }, b: { draggerName: "Blair" } } },
    };

    for (const page of ["AdminSorting.jsx", "BidCommitteeSorting.jsx", "BrotherSorting.jsx"]) {
        for (const [scenario, values] of Object.entries(scenarios)) {
            const html = renderToStaticMarkup(React.createElement(SortingPresenceIndicator, {
                ...values,
                hideWhenAlone: page === "AdminSorting.jsx",
            }));
            const hash = createHash("sha256").update(html).digest("hex");
            assert.equal(hash, expected[`${page}_${scenario}`], `${page} ${scenario} changed`);
        }
    }
});
