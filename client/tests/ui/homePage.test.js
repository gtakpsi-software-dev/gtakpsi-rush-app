import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const pagePath = fileURLToPath(new URL("../../src/pages/Home.jsx", import.meta.url));

// Load home with injected dependencies for isolated tests.
async function loadHome(isMidtermMode, navigations = []) {
    return loadTsxComponent(pagePath, {
        "react-router-dom": {
            // Provide the callback used by this dependency stub.
            useNavigate: () => /* Record callback arguments for assertions. */ (path) => navigations.push(path),
        },
        "../contexts/MidtermModeContext": {
            // Return the use midterm mode fixture for this scenario.
            useMidtermMode: () => ({ isMidtermMode }),
        },
    });
}

// Collect buttons from the rendered element tree.
function buttons(node) {
    if (!React.isValidElement(node)) return [];
    return [
        ...(node.type === "button" ? [node] : []),
        ...React.Children.toArray(node.props.children).flatMap(buttons),
    ];
}

test("Home retains regular and midterm markup", async () => {
    // Verify Home retains regular and midterm markup.
    const regular = await loadHome(false);
    const midterm = await loadHome(true);
    const hashes = [regular, midterm].map((Page) => {
        // Render each home page and hash its markup.
        const html = renderToStaticMarkup(React.createElement(Page));
        return createHash("sha256").update(html).digest("hex");
    });

    assert.deepEqual(hashes, [
        "8856057a2a0f324ffa2a9b4b8265c00ca6d3a155fb58380428fc32f86538695a",
        "02c487e17e71855da5b304eb742c3c18345025dc1659a473002384714f24163d",
    ]);
});

test("Home retains rush registration and login navigation", async () => {
    // Verify Home retains rush registration and login navigation.
    const regularPaths = [];
    const RegularHome = await loadHome(false, regularPaths);
    const regularButtons = buttons(RegularHome());
    assert.equal(regularButtons.length, 2);
    regularButtons.forEach(/* Invoke button.props.onClick with the test inputs. */ (button) => button.props.onClick());
    assert.deepEqual(regularPaths, ["/register", "/login"]);

    const midtermPaths = [];
    const MidtermHome = await loadHome(true, midtermPaths);
    const midtermButtons = buttons(MidtermHome());
    assert.equal(midtermButtons.length, 1);
    midtermButtons[0].props.onClick();
    assert.deepEqual(midtermPaths, ["/login"]);
});
