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

import { createEmptyColumns, MAX_SCALE, MIN_SCALE, STATUSES } from "../src/features/sorting/board.js";

const fixturePath = fileURLToPath(new URL("./fixtures/viewerSortingPageMarkup.json", import.meta.url));
const viewPath = fileURLToPath(new URL("../src/features/sorting/ViewerSortingBoardView.tsx", import.meta.url));
const noop = () => {};

async function loadBoardView(dependencies) {
    const source = await readFile(viewPath, "utf8");
    const { code } = await transformWithEsbuild(source, viewPath, {
        loader: "tsx", format: "cjs", jsx: "automatic",
    });
    const module = { exports: {} };
    const requireFromView = createRequire(viewPath);

    runInNewContext(code, {
        module,
        exports: module.exports,
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromView(specifier);
        },
    }, { filename: viewPath });

    return module.exports.default;
}

async function loadPage(name, state = {}, captured = new Map()) {
    const pagePath = fileURLToPath(new URL(`../src/pages/${name}.jsx`, import.meta.url));
    const stub = (component) => function Stub(props) {
        captured.set(component, props);
        return React.createElement("span", { "data-stub": component });
    };
    const boardView = await loadBoardView({
        "../../components/Navbar": stub("navbar"),
        "./board": { STATUSES },
        "./ViewerSortingColumn": stub("column"),
        "./SortingZoomControls": stub("zoom"),
        "./SortingPresenceIndicator": stub("presence"),
        "./SortingGhostCards": stub("ghosts"),
    });
    const BoardViewWithCapture = (props) => {
        captured.set("board-view", props);
        const tree = boardView(props);
        captured.set("board-root", tree.props);
        captured.set("board-root-ref", tree.ref);
        return tree;
    };
    let stateIndex = 0;
    const dependencies = {
        react: {
            ...React,
            useState(initial) {
                const index = stateIndex++;
                return [Object.hasOwn(state, index) ? state[index] : initial, noop];
            },
            useEffect: noop,
            useRef: (initial) => ({ current: initial }),
            useCallback: (callback) => callback,
        },
        "react-router-dom": { useNavigate: () => noop },
        "react-toastify": { toast: { error: noop } },
        "react-toastify/dist/ReactToastify.css": {},
        "../components/Navbar": stub("navbar"),
        "../firebase": { auth: {} },
        "../config/realtimeBaseUrls": { realtimeBaseUrls: { sorting: "ws://localhost" } },
        axios: { get: noop },
        "../features/admin/api": { adminGet: noop, adminPut: noop },
        "../features/sorting/board": { STATUSES, MIN_SCALE, MAX_SCALE, createEmptyColumns },
        "../features/sorting/ReadOnlyDetailsPanel": stub("read-only-details"),
        "../features/sorting/EditableNotesPanel": stub("editable-notes"),
        "../features/sorting/ViewerSortingBoardView": BoardViewWithCapture,
        "../features/sorting/ViewerSortingColumn": stub("column"),
        "../features/sorting/SortingZoomControls": stub("zoom"),
        "../features/sorting/SortingPresenceIndicator": stub("presence"),
        "../features/sorting/SortingGhostCards": stub("ghosts"),
        "../features/sorting/createSortingViewportHandlers": {
            createSortingViewportHandlers: () => new Proxy({}, { get: () => noop }),
        },
        "../features/sorting/createSortingNotesHandlers": {
            createSortingNotesHandlers: () => new Proxy({}, { get: () => noop }),
        },
        "../features/sorting/connectSortingViewer": { connectSortingViewer: noop },
        "../features/sorting/cleanupStaleSortingGhosts": { cleanupStaleSortingGhosts: noop },
        "../features/sorting/loadBidComSortingData": { loadBidComSortingData: noop },
        "../features/sorting/loadBrotherSortingData": { loadBrotherSortingData: noop },
    };
    const source = (await readFile(pagePath, "utf8"))
        .replaceAll("import.meta.env.VITE_API_PREFIX", '"/api"')
        .replace("import.meta.env.VITE_ADMIN_ALLOWLIST", '"admin@example.edu"');
    const { code } = await transformWithEsbuild(source, pagePath, {
        loader: "jsx", format: "cjs", jsx: "automatic",
    });
    const module = { exports: {} };
    const requireFromPage = createRequire(pagePath);

    runInNewContext(code, {
        module,
        exports: module.exports,
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromPage(specifier);
        },
    }, { filename: pagePath });

    return module.exports.default;
}

test("brother and bid-committee viewer pages retain their loading and board markup", async () => {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const scenarios = {
        BrotherSorting: { loading: {}, ready: { 0: false }, details: { 0: false, 2: { id: "r1" } } },
        BidComSorting: { loading: {}, ready: { 0: false }, details: { 0: false, 3: { id: "r1" } } },
    };
    const actual = {};

    for (const [name, states] of Object.entries(scenarios)) {
        actual[name] = {};
        for (const [scenario, state] of Object.entries(states)) {
            const Page = await loadPage(name, state);
            const html = renderToStaticMarkup(React.createElement(Page));
            actual[name][scenario] = createHash("sha256").update(html).digest("hex");
        }
    }
    assert.deepEqual(actual, expected);
});

test("viewer pages pass the original board state and audience to their controls", async () => {
    const columns = { ...createEmptyColumns(), UNSORTED: [{ id: "r1" }] };
    const selected = { id: "r1", rushNumber: 7 };
    const cases = [
        {
            name: "BrotherSorting",
            state: { 0: false, 1: columns, 2: selected, 6: 1.5, 8: true, 9: 3 },
            details: "read-only-details",
            showRusheeNames: true,
        },
        {
            name: "BidComSorting",
            state: { 0: false, 2: columns, 3: selected, 7: 1.5, 9: true, 10: 3 },
            details: "editable-notes",
            showRusheeNames: false,
        },
    ];

    for (const { name, state, details, showRusheeNames } of cases) {
        const captured = new Map();
        const Page = await loadPage(name, state, captured);
        renderToStaticMarkup(React.createElement(Page));

        assert.equal(captured.get("column").columns, columns);
        assert.equal(captured.get("column").showRusheeNames, showRusheeNames);
        assert.equal(captured.get("zoom").scale, 1.5);
        assert.equal(captured.get("presence").connected, true);
        assert.equal(captured.get("presence").viewerCount, 3);
        assert.equal(captured.get("board-root-ref"), captured.get("board-view").canvasRef);
        assert.equal(captured.get("board-root").onMouseDown, captured.get("board-view").onMouseDown);
        assert.equal(captured.get("board-root").onMouseMove, captured.get("board-view").onMouseMove);
        assert.equal(captured.get("board-root").onMouseUp, captured.get("board-view").onMouseUp);
        assert.equal(captured.get("board-root").onMouseLeave, captured.get("board-view").onMouseUp);
        assert.equal(captured.get("board-root").onContextMenu, captured.get("board-view").onContextMenu);
        assert.equal(captured.get(details).selectedRushee, selected);
        assert.equal(typeof captured.get(details).onViewRushee, "function");
    }
});
