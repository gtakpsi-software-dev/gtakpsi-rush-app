import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const pagePath = fileURLToPath(new URL("../../src/components/Error.tsx", import.meta.url));

// Load page with injected dependencies for isolated tests.
async function loadPage(params, navigate = /* Leave this mocked callback inert. */ () => {}) {
    return loadTsxComponent(pagePath, {
        "react-router-dom": {
            // Return params to the caller.
            useParams: () => params,
            // Return navigate to the caller.
            useNavigate: () => navigate,
        },
    });
}

test("error page retains fallback, route, 404, and ignored-prop markup", async () => {
    // Verify error page retains fallback, route, 404, and ignored-prop markup.
    const cases = {
        fallback: [{}, {}],
        route: [{ title: "Route Title", description: "Route Description" }, {}],
        wrongpage: [{ title: "Route Title", description: "Route Description" }, { wrongpage: true }],
        ignoredProps: [{}, { title: "Prop Title", description: "Prop Description" }],
    };
    const actual = {};
    for (const [name, [params, props]] of Object.entries(cases)) {
        const Page = await loadPage(params);
        const html = renderToStaticMarkup(React.createElement(Page, props));
        actual[name] = createHash("sha256").update(html).digest("hex");
    }

    assert.deepEqual(actual, {
        fallback: "76364dda722d51c5c2e102141c6ac344712e30671f3e92dfadffeab57ed46347",
        route: "bed04c28fa4a2760a035303f3c3a4d6c7d2a3acb35a05220ed109d82e3546ebc",
        wrongpage: "66aa3a699676893bfdaeb1a8384d0b4d872f0793d77dc9d9915953a75f8fc0a3",
        ignoredProps: "76364dda722d51c5c2e102141c6ac344712e30671f3e92dfadffeab57ed46347",
    });
});

test("Go Home keeps navigating to the root", async () => {
    // Verify Go Home keeps navigating to the root.
    const paths = [];
    const Page = await loadPage({}, /* Record callback arguments for assertions. */ (path) => paths.push(path));
    const tree = Page({});
    // Find the first button in the rendered element tree.
    const findButton = (node) => {
        if (!React.isValidElement(node)) return null;
        if (node.type === "button") return node;
        for (const child of React.Children.toArray(node.props.children)) {
            const button = findButton(child);
            if (button) return button;
        }
        return null;
    };

    findButton(tree).props.onClick();
    assert.deepEqual(paths, ["/"]);
});
