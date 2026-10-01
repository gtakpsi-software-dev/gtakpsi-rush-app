import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithEsbuild } from "vite";
import { formatRatingValue } from "../src/features/comments/ratingDisplay.js";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const pagePath = fileURLToPath(new URL("../src/pages/Comments.jsx", import.meta.url));
const viewPath = fileURLToPath(new URL("../src/features/comments/CommentsView.tsx", import.meta.url));
const requireFromPage = createRequire(pagePath);
const entry = {
    rushee: { image_url: "/ada.jpg", first_name: "Ada", last_name: "Example", gtid: "123" },
    comments: [{
        night: { name: "Rush Night" },
        comment: "Good",
        ratings: [{ name: "Why", value: 4 }],
    }],
};

async function loadPage({ state = {}, storedUser = null, response } = {}) {
    const View = await loadTsxComponent(viewPath, {
        "../../components/Navbar": () => React.createElement("span", { "data-stub": "navbar" }),
        "./ratingDisplay": { formatRatingValue },
    });
    const source = (await readFile(pagePath, "utf8"))
        .replaceAll("import.meta.env.VITE_API_PREFIX", '"/api"')
        .replaceAll("import.meta.env.VITE_API_KEY", '"key"');
    const { code } = await transformWithEsbuild(source, pagePath, {
        loader: "jsx", format: "cjs", jsx: "automatic",
    });
    const effects = [];
    const updates = [];
    const requests = [];
    const navigations = [];
    let stateIndex = 0;
    const dependencies = {
        react: {
            ...React,
            useState(initial) {
                const index = stateIndex++;
                return [Object.hasOwn(state, index) ? state[index] : initial,
                    (value) => updates.push([index, value])];
            },
            useEffect: (effect) => effects.push(effect),
        },
        "react-router-dom": { useNavigate: () => (path) => navigations.push(path) },
        "../features/comments/CommentsView": View,
    };
    const module = { exports: {} };
    runInNewContext(code, {
        module,
        exports: module.exports,
        localStorage: { getItem: () => storedUser },
        fetch: async (url, options) => {
            requests.push({ url, options });
            return { json: async () => response };
        },
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromPage(specifier);
        },
    }, { filename: pagePath });

    return { Page: module.exports.default, effects, updates, requests, navigations };
}

test("Your Comments retains loading, error, empty, and populated markup", async () => {
    const scenarios = {
        loading: {},
        error: { 1: false, 2: "Oops" },
        empty: { 0: [], 1: false },
        entries: { 0: [entry], 1: false },
    };
    const actual = {};
    for (const [name, state] of Object.entries(scenarios)) {
        const { Page } = await loadPage({ state });
        const html = renderToStaticMarkup(React.createElement(Page));
        actual[name] = createHash("sha256").update(html).digest("hex");
    }

    assert.deepEqual(actual, {
        loading: "5b06b3540a070f33850ad07c8d8d097d55466c9c0f9264445913228291a6fe31",
        error: "55bb0e02d5577f310715726f1f161416854276264005698f70495f9b2ba7fe87",
        empty: "d8b8984bc56bf816e1be14f23751c11f77cbdd93b65ec4d933e47920810fe1ee",
        entries: "11c39a6a939e98a3d688e7349917819542dc9500b5e9ae17a9f76b4420dd09e8",
    });
});

test("missing identity retains the error state without fetching", async () => {
    const { Page, effects, updates, requests } = await loadPage();
    Page();
    effects[0]();
    await setImmediate();

    assert.equal(requests.length, 0);
    assert.deepEqual(updates.map(([index, value]) => [index, value]), [
        [1, true], [2, null], [2, "User not logged in."], [1, false],
    ]);
});

test("comment fetch retains the encoded brother path and API key header", async () => {
    const { Page, effects, requests, updates } = await loadPage({
        storedUser: '{"firstname":"Sam","lastname":"Brother"}',
        response: { status: "success", payload: [entry] },
    });
    Page();
    effects[0]();
    await setImmediate();

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "/api/brother/comments/Sam%20Brother");
    assert.equal(requests[0].options.headers["X-API-Key"], "key");
    assert.equal(updates.find(([index]) => index === 0)[1][0].rushee.gtid, "123");
});

test("View full profile keeps the brother rushee route", async () => {
    const { Page, navigations } = await loadPage({ state: { 0: [entry], 1: false } });
    const view = Page();
    const tree = view.type(view.props);
    const findButton = (node) => {
        if (!React.isValidElement(node)) return null;
        if (node.type === "button") return node;
        for (const child of React.Children.toArray(node.props.children)) {
            const found = findButton(child);
            if (found) return found;
        }
        return null;
    };

    findButton(tree).props.onClick();
    assert.deepEqual(navigations, ["/brother/rushee/123"]);
});
