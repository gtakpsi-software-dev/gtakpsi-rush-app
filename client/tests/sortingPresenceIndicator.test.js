import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithEsbuild } from "vite";

const fixturePath = fileURLToPath(new URL("./fixtures/sortingPresenceIndicator.json", import.meta.url));
const componentPath = fileURLToPath(new URL("../src/features/sorting/SortingPresenceIndicator.tsx", import.meta.url));
const require = createRequire(import.meta.url);

async function loadIndicator() {
    const source = await readFile(componentPath, "utf8");
    const compiled = await transformWithEsbuild(source, componentPath, {
        loader: "tsx",
        format: "cjs",
        jsx: "automatic",
    });
    const module = { exports: {} };
    runInNewContext(compiled.code, { module, exports: module.exports, require }, { filename: componentPath });
    return module.exports.default;
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

    for (const page of ["AdminSorting.jsx", "BidComSorting.jsx", "BrotherSorting.jsx"]) {
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
