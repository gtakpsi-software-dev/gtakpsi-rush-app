import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const pagePath = fileURLToPath(new URL("../../src/pages/NotFound.jsx", import.meta.url));

// Load page with injected dependencies for isolated tests.
async function loadPage(navigate = /* Leave this mocked callback inert. */ () => {}) {
    return loadTsxComponent(pagePath, {
        "react-router-dom": { useNavigate: /* Return navigate to the caller. */ () => navigate },
        "@react-three/fiber": {
            // Render a lightweight React element for component assertions.
            Canvas: () => React.createElement("span", { "data-stub": "canvas" }),
        },
        // Return no value from this dependency stub.
        "../features/notFound/LiquidShader": () => null,
    });
}

test("404 overlay retains the previous markup", async () => {
    // Verify 404 overlay retains the previous markup.
    const Page = await loadPage();
    const html = renderToStaticMarkup(React.createElement(Page));
    const hash = createHash("sha256").update(html).digest("hex");

    assert.equal(hash, "28a4b0309887278e2b458f541257e1290ec13fa65b967d3c25acd7c1c3eb2e70");
});

test("404 canvas settings and Go Back destination stay the same", async () => {
    // Verify 404 canvas settings and Go Back destination stay the same.
    const paths = [];
    const Page = await loadPage(/* Record callback arguments for assertions. */ (path) => paths.push(path));
    const tree = Page();
    const elements = [];
    // Walk the rendered element tree to collect nodes for assertions.
    function collect(node) {
        if (!React.isValidElement(node)) return;
        elements.push(node);
        React.Children.forEach(node.props.children, collect);
    }
    collect(tree);

    const canvas = elements.find(/* Match node.props.camera. */ (node) => node.props.camera);
    const button = elements.find(/* Identify rendered button elements. */ (node) => node.type === "button");
    assert.deepEqual(Array.from(canvas.props.camera.position), [0, 0, 1]);
    assert.equal(canvas.props.className, "absolute top-0 left-0 w-full h-full");
    button.props.onClick();
    assert.deepEqual(paths, ["/"]);
});
