import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const pagePath = fileURLToPath(new URL("../src/pages/Home.jsx", import.meta.url));

async function loadHome(isMidtermMode, navigations = []) {
    return loadTsxComponent(pagePath, {
        "react-router-dom": {
            useNavigate: () => (path) => navigations.push(path),
        },
        "../contexts/MidtermModeContext": {
            useMidtermMode: () => ({ isMidtermMode }),
        },
    });
}

function buttons(node) {
    if (!React.isValidElement(node)) return [];
    return [
        ...(node.type === "button" ? [node] : []),
        ...React.Children.toArray(node.props.children).flatMap(buttons),
    ];
}

test("Home retains regular and midterm markup", async () => {
    const regular = await loadHome(false);
    const midterm = await loadHome(true);
    const hashes = [regular, midterm].map((Page) => {
        const html = renderToStaticMarkup(React.createElement(Page));
        return createHash("sha256").update(html).digest("hex");
    });

    assert.deepEqual(hashes, [
        "8856057a2a0f324ffa2a9b4b8265c00ca6d3a155fb58380428fc32f86538695a",
        "02c487e17e71855da5b304eb742c3c18345025dc1659a473002384714f24163d",
    ]);
});

test("Home retains rush registration and login navigation", async () => {
    const regularPaths = [];
    const RegularHome = await loadHome(false, regularPaths);
    const regularButtons = buttons(RegularHome());
    assert.equal(regularButtons.length, 2);
    regularButtons.forEach((button) => button.props.onClick());
    assert.deepEqual(regularPaths, ["/register", "/login"]);

    const midtermPaths = [];
    const MidtermHome = await loadHome(true, midtermPaths);
    const midtermButtons = buttons(MidtermHome());
    assert.equal(midtermButtons.length, 1);
    midtermButtons[0].props.onClick();
    assert.deepEqual(midtermPaths, ["/login"]);
});
