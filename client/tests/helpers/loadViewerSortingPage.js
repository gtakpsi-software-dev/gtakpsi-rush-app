import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import React from "react";
import { transformWithEsbuild } from "vite";

import { createEmptyColumns, MAX_SCALE, MIN_SCALE, STATUSES } from "../../src/features/sorting/board.js";
import { createSortingViewportHandlers } from "../../src/features/sorting/createSortingViewportHandlers.js";
import { parseAdminAllowlist } from "../../src/features/auth/parseAdminAllowlist.js";
import { loadTsxModule } from "./loadTsxComponent.js";

const viewPath = fileURLToPath(new URL("../../src/features/sorting/ViewerSortingBoardView.tsx", import.meta.url));
const viewportPath = fileURLToPath(new URL("../../src/features/sorting/useSortingViewport.js", import.meta.url));
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

export async function loadPage(name, state = {}, captured = new Map()) {
    const pagePath = fileURLToPath(new URL(`../../src/pages/${name}.jsx`, import.meta.url));
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
    const reactMock = {
        ...React,
        useState(initial) {
            const index = stateIndex++;
            return [Object.hasOwn(state, index) ? state[index] : initial, noop];
        },
        useEffect: (effect, deps) => {
            if (!captured.has('effects')) captured.set('effects', []);
            captured.get('effects').push({ effect, deps });
        },
        useRef: (initial) => ({ current: initial }),
        useCallback: (callback) => callback,
    };
    const { useSortingViewport } = await loadTsxModule(viewportPath, {
        react: reactMock,
        './board': { MIN_SCALE, MAX_SCALE },
        './createSortingViewportHandlers': { createSortingViewportHandlers },
    });
    const dependencies = {
        react: reactMock,
        "react-router-dom": { useNavigate: () => noop },
        "react-toastify": { toast: { error: noop } },
        "react-toastify/dist/ReactToastify.css": {},
        "../components/Navbar": stub("navbar"),
        "../firebase": { auth: {} },
        axios: { get: (path) => captured.set("axios-get", path) },
        "../features/admin/api": { adminGet: noop, adminPut: noop },
        "../features/auth/parseAdminAllowlist": { parseAdminAllowlist },
        "../features/sorting/board": { STATUSES, MIN_SCALE, MAX_SCALE, createEmptyColumns },
        "../features/sorting/ReadOnlyDetailsPanel": stub("read-only-details"),
        "../features/sorting/EditableNotesPanel": stub("editable-notes"),
        "../features/sorting/ViewerSortingBoardView": BoardViewWithCapture,
        "../features/sorting/ViewerSortingColumn": stub("column"),
        "../features/sorting/SortingZoomControls": stub("zoom"),
        "../features/sorting/SortingPresenceIndicator": stub("presence"),
        "../features/sorting/SortingGhostCards": stub("ghosts"),
        "../features/sorting/useSortingViewport": { useSortingViewport },
        "../features/sorting/useSortingWheelListener": {
            useSortingWheelListener: (canvasRef, handleWheel, loading) => {
                captured.set("wheel-listener", { canvasRef, handleWheel, loading });
            },
        },
        "../features/sorting/createSortingNotesHandlers": {
            createSortingNotesHandlers: () => new Proxy({}, { get: () => noop }),
        },
        "../features/sorting/createBrotherSortingDetailsHandlers": {
            createBrotherSortingDetailsHandlers: (options) => {
                captured.set("brother-details-options", options);
                const handlers = { openDetails: () => {}, closeDetails: () => {} };
                captured.set("brother-details-handlers", handlers);
                return handlers;
            },
        },
        "../features/sorting/useSortingViewerConnection": {
            useSortingViewerConnection: (options) => captured.set("viewer-connection", options),
        },
        "../features/sorting/loadBidCommitteeSortingData": { loadBidCommitteeSortingData: noop },
        "../features/sorting/subscribeToSortingAuth": {
            subscribeToSortingAuth: (options) => captured.set("auth-subscription", options),
        },
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

