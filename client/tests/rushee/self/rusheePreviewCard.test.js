import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithEsbuild } from "vite";
import { loadTsxComponent, loadTsxModule } from "../../helpers/loadTsxComponent.js";

const pagePath = fileURLToPath(new URL("../../../src/features/voting/admin/RusheePreviewCard.tsx", import.meta.url));
const searchPath = fileURLToPath(new URL("../../../src/features/voting/admin/RusheePreviewSearch.tsx", import.meta.url));
const currentPath = fileURLToPath(new URL("../../../src/features/voting/admin/CurrentRusheePreview.tsx", import.meta.url));
const searchFunctionsPath = fileURLToPath(new URL("../../../src/features/voting/admin/previewRusheeSearch.ts", import.meta.url));
const { filterPreviewRushees, previewRusheeName } = await loadTsxModule(searchFunctionsPath);

const selected = {
    first_name: "Sam", last_name: "Example", gtid: "123", major: "Business",
    pronouns: "they/them", image_url: "https://example.test/photo.jpg",
    comments: [], ratings: [{ name: "Professionalism", value: 4.5 }],
    interactions_by_night: [], attendance: [],
};

function findElement(node, predicate) {
    if (Array.isArray(node)) return node.map((child) => findElement(child, predicate)).find(Boolean);
    if (!React.isValidElement(node)) return null;
    if (predicate(node)) return node;
    if (typeof node.type === "function") return findElement(node.type(node.props), predicate);
    return findElement(node.props.children, predicate);
}

async function loadCard({ state = {}, rushee = null } = {}) {
    const updates = [];
    const gets = [];
    const posts = [];
    const interactions = () => React.createElement("span", { "data-stub": "interactions" });
    const search = await loadTsxComponent(searchPath, {
        "./previewRusheeSearch": { previewRusheeName },
    });
    const current = await loadTsxComponent(currentPath, {
        "../../../components/RusheeInteractionsByNight": interactions,
    });
    let stateIndex = 0;
    const dependencies = {
        react: {
            ...React,
            useState(initial) {
                const index = stateIndex++;
                return [Object.hasOwn(state, index) ? state[index] : initial,
                    (value) => updates.push([index, value])];
            },
            useMemo: (calculate) => calculate(),
        },
        "./AdminVotingContext": { useAdminVotingContext: () => ({ rushee }) },
        "../../../components/RusheeInteractionsByNight": interactions,
        axios: { get: async (url) => {
            gets.push(url);
            return { data: { status: "success", payload: [selected] } };
        } },
        "../../admin/api": { adminPost: (url, payload) => {
            posts.push({ url, payload });
            return Promise.resolve();
        } },
        "react-toastify": { toast: { promise: (request) => request } },
        "./previewRusheeSearch": { filterPreviewRushees, previewRusheeName },
        "./RusheePreviewSearch": search,
        "./CurrentRusheePreview": current,
    };
    const source = (await readFile(pagePath, "utf8"))
        .replaceAll("import.meta.env.VITE_API_PREFIX", '"/api"');
    const compiled = await transformWithEsbuild(source, pagePath, {
        loader: "tsx", format: "cjs", jsx: "automatic",
    });
    const module = { exports: {} };
    const requireFromPage = createRequire(pagePath);
    runInNewContext(compiled.code, {
        module,
        exports: module.exports,
        console: { log() {}, error() {} },
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromPage(specifier);
        },
    }, { filename: pagePath });

    return { Card: module.exports.default, updates, gets, posts };
}

test("rushee preview keeps empty, selected, loading, results, and no-match markup", async () => {
    const scenarios = {
        empty: {},
        selected: { rushee: selected },
        loading: { state: { 0: true, 3: true } },
        results: { state: { 0: true, 1: "sam", 2: [selected] }, rushee: selected },
        noMatch: { state: { 0: true, 1: "missing", 2: [selected] } },
    };
    const actual = {};
    for (const [name, options] of Object.entries(scenarios)) {
        const { Card } = await loadCard(options);
        const html = renderToStaticMarkup(React.createElement(Card));
        actual[name] = createHash("sha256").update(html).digest("hex");
    }
    assert.deepEqual(actual, {
        empty: "9e8fb5355d852dff0e96b0250a5beed17f40c002dd443d2818682d9be5a34b73",
        selected: "51da0cd249ef8812ae92c2c8ee1fe825f8a10e6caa7d2e24c200f81c979826fa",
        loading: "72152095973ff3875ea5db056dfe2daf3cda782d5a7783ad270f5893f57bd0c5",
        results: "b98017301e8a09888d27e7dd047569f62de4395d6d1853c63cd064098ee190fe",
        noMatch: "5fd54e6325b6ce18963625ca2cb82cdee208e4ca25d60034ee785934cf44b1e9",
    });
});

test("rushee preview retains search request and selection action order", async () => {
    const search = await loadCard();
    const input = findElement(search.Card(), (node) => node.type === "input");
    await input.props.onFocus();
    assert.deepEqual(search.updates.map(([index]) => index), [0, 3, 2, 3]);
    assert.deepEqual(search.gets, ["/api/rushee/get-rushees"]);
    assert.equal(search.updates[2][1][0], selected);

    const results = await loadCard({ state: { 0: true, 1: "sam", 2: [selected] } });
    const row = findElement(results.Card(), (node) => node.type === "li");
    await row.props.onClick();
    assert.equal(results.posts.length, 1);
    assert.equal(results.posts[0].url, "/api/admin/voting/change-rushee");
    assert.equal(results.posts[0].payload.gtid, "123");
    assert.deepEqual(results.updates.map(([index, value]) => [index, value]), [[0, false], [1, ""]]);
});
