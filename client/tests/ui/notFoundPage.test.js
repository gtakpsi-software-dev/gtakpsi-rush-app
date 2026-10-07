import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const pagePath = fileURLToPath(new URL("../../src/pages/NotFound.jsx", import.meta.url));

async function loadPage(navigate = () => {}) {
    return loadTsxComponent(pagePath, {
        "react-router-dom": { useNavigate: () => navigate },
        "@react-three/fiber": {
            Canvas: () => React.createElement("span", { "data-stub": "canvas" }),
        },
        "../features/notFound/LiquidShader": () => null,
    });
}

test("404 overlay retains the previous markup", async () => {
    const Page = await loadPage();
    const html = renderToStaticMarkup(React.createElement(Page));
    const hash = createHash("sha256").update(html).digest("hex");

    assert.equal(hash, "28a4b0309887278e2b458f541257e1290ec13fa65b967d3c25acd7c1c3eb2e70");
});

test("404 canvas settings and Go Back destination stay the same", async () => {
    const paths = [];
    const Page = await loadPage((path) => paths.push(path));
    const tree = Page();
    const elements = [];
    function collect(node) {
        if (!React.isValidElement(node)) return;
        elements.push(node);
        React.Children.forEach(node.props.children, collect);
    }
    collect(tree);

    const canvas = elements.find((node) => node.props.camera);
    const button = elements.find((node) => node.type === "button");
    assert.deepEqual(Array.from(canvas.props.camera.position), [0, 0, 1]);
    assert.equal(canvas.props.className, "absolute top-0 left-0 w-full h-full");
    button.props.onClick();
    assert.deepEqual(paths, ["/"]);
});
