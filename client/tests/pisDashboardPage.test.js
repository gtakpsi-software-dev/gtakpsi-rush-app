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
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";
import { loadPisDashboardData } from "../src/features/pis/dashboard/loadPisDashboardData.js";

const pagePath = fileURLToPath(new URL("../src/pages/PISDashboard.jsx", import.meta.url));
const viewPath = fileURLToPath(new URL("../src/features/pis/dashboard/PisDashboardView.tsx", import.meta.url));
const rushee = {
    id: "r1", gtid: "900000001", name: "Ada Example", image_url: "/headshot.jpg",
    email: "ada@example.edu", major: "Business",
    attendance: [{ name: "Night One" }], ratings: [{ name: "Professionalism", value: 4 }],
};

async function loadPage(state = {}, showRatings = false, navigations = [], runtime = {}) {
    const source = (await readFile(pagePath, "utf8"))
        .replaceAll("import.meta.env.VITE_API_PREFIX", '"/api"');
    const { code } = await transformWithEsbuild(source, pagePath, {
        loader: "jsx", format: "cjs", jsx: "automatic",
    });
    const module = { exports: {} };
    const requireFromPage = createRequire(pagePath);
    let stateIndex = 0;
    function Stub({ children, ...props }) {
        return React.createElement("span", { "data-stub": props.text || "component" }, children);
    }
    Stub.propTypes = { children: () => null, text: () => null };
    const View = await loadTsxComponent(viewPath, {
        "../../../components/Loader": Stub,
        "../../../components/Navbar": Stub,
        "../../../components/Badge": Stub,
    });

    runInNewContext(code, {
        module,
        exports: module.exports,
        localStorage: { getItem: () => '{"firstname":"A","lastname":"B"}' },
        console: { log: (value) => runtime.logs?.push(value) },
        require(specifier) {
            const dependencies = {
                react: {
                    ...React,
                    useState(initial) {
                        const index = stateIndex++;
                        return [Object.hasOwn(state, index) ? state[index] : initial,
                            (value) => runtime.updates?.push([index, value])];
                    },
                    useEffect(effect, dependencies) {
                        runtime.effects?.push(effect);
                        runtime.dependencies?.push(Array.from(dependencies));
                    },
                },
                "react-router-dom": { useNavigate: () => (path) => navigations.push(path) },
                axios: { post: (...args) => {
                    runtime.requests?.push(args);
                    return runtime.post?.(...args) ?? Promise.resolve({ data: { status: "success", payload: [] } });
                } },
                "../components/Loader": Stub,
                "../components/Navbar": Stub,
                "../components/Badge": Stub,
                "../components/Error": Stub,
                "../features/pis/dashboard/PisDashboardView": View,
                "../features/pis/dashboard/loadPisDashboardData": { loadPisDashboardData },
                "../features/auth/verifyUser": {
                    verifyUser: () => runtime.verify?.() ?? Promise.resolve(true),
                },
                "../features/comments/useCommentVisibility": { useCommentVisibility: () => ({ showAll: showRatings }) },
            };
            return Object.hasOwn(dependencies, specifier)
                ? dependencies[specifier]
                : requireFromPage(specifier);
        },
    }, { filename: pagePath });

    return module.exports.default;
}

function collect(node, elements = []) {
    if (!React.isValidElement(node)) return elements;
    elements.push(node);
    React.Children.forEach(node.props.children, (child) => collect(child, elements));
    return elements;
}

test("PIS dashboard retains loading, error, and both card markup states", async () => {
    const scenarios = {
        loading: [{}, false],
        error: [{ 2: true, 3: "Problem", 4: "No access" }, false],
        ready: [{ 0: [rushee], 1: false }, false],
        ratings: [{ 0: [rushee], 1: false }, true],
    };
    const actual = {};
    for (const [name, [state, showRatings]] of Object.entries(scenarios)) {
        const Page = await loadPage(state, showRatings);
        const html = renderToStaticMarkup(React.createElement(Page));
        actual[name] = createHash("sha256").update(html).digest("hex");
    }
    assert.deepEqual(actual, {
        loading: "a40a01ab1d2f88b6b94c003d6cdf18f69514a9a2a0c9dc0dd1da4cbb03689e9f",
        error: "cffa857b5de88836c41a3cffc77eb09d17b1d929d9ed7dc5ca38baa10aee4a63",
        ready: "8bdea36fe520966fb2a3b27c675e2c0564c80e22f1e034aae486f077dd32c03a",
        ratings: "5ea77da64445beaeb931a3d795ef786c1dfd53034bf657ed1c71fbafe3bbcf68",
    });
});

test("PIS card retains navigation to the selected rushee", async () => {
    const navigations = [];
    const Page = await loadPage({ 0: [rushee], 1: false }, false, navigations);
    const view = Page();
    const card = collect(view.type(view.props))
        .find((element) => element.props.className?.includes("hover:border-blue-500"));
    card.props.onClick();
    assert.deepEqual(navigations, ["/brother/rushee/900000001"]);
});

async function runFetch(runtime) {
    const navigations = [];
    const Page = await loadPage({}, false, navigations, runtime);
    Page();
    runtime.effects[0]();
    await setImmediate();
    return navigations;
}

test("PIS dashboard retains verification, request, and success update order", async () => {
    const runtime = {
        effects: [], dependencies: [], updates: [], requests: [], logs: [],
        verify: async () => false,
        post: async () => ({ data: { status: "success", payload: [rushee] } }),
    };
    const navigations = await runFetch(runtime);

    assert.equal(runtime.dependencies.length, 1);
    assert.equal(runtime.dependencies[0].length, 2);
    assert.equal(runtime.dependencies[0][0], true);
    assert.equal(typeof runtime.dependencies[0][1], "function");
    assert.deepEqual(navigations, ["/"]);
    assert.deepEqual(JSON.parse(JSON.stringify(runtime.requests)), [[
        "/api/admin/get-brother-pis", { first_name: "A", last_name: "B" },
    ]]);
    assert.deepEqual(runtime.updates, [[1, true], [0, [rushee]], [1, false]]);
    assert.deepEqual(runtime.logs, [[rushee]]);
});

test("PIS dashboard retains status, network, and verification error messages", async () => {
    for (const [post, expected] of [
        [async () => ({ data: { status: "error" } }), "There was some issue fetching the rushees"],
        [async () => { throw Error("offline"); }, "There was some network error while fetching the rushees."],
    ]) {
        const runtime = { effects: [], updates: [], requests: [], post };
        await runFetch(runtime);
        assert.deepEqual(runtime.updates, [
            [1, true], [4, expected], [2, true], [1, false],
        ]);
    }

    const failure = Error("invalid token");
    const runtime = {
        effects: [], updates: [], requests: [], logs: [],
        verify: async () => { throw failure; },
    };
    await runFetch(runtime);
    assert.deepEqual(runtime.requests, []);
    assert.deepEqual(runtime.logs, [failure]);
    assert.deepEqual(runtime.updates, [
        [1, true], [4, "There was an error verifying your credentials."],
        [2, true], [1, false],
    ]);
});
