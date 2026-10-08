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
// Supply an inert callback where this test does not exercise the handler.
const noop = () => {};

// Load board view with injected dependencies for isolated tests.
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
        // Resolve injected test dependencies before falling back to real modules.
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromView(specifier);
        },
    }, { filename: viewPath });

    return module.exports.default;
}

// Load page with injected dependencies for isolated tests.
export async function loadPage(name, state = {}, captured = new Map()) {
    const pagePath = fileURLToPath(new URL(`../../src/pages/${name}.jsx`, import.meta.url));
    // Create a lightweight component that captures props for assertions.
    const stub = (component) => function Stub(props) {
        // Capture component props and render a placeholder element.
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
    // Capture board props, root props, and the root ref while rendering.
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
        // Expose controlled hook state and capture updates for assertions.
        useState(initial) {
            const index = stateIndex++;
            return [Object.hasOwn(state, index) ? state[index] : initial, noop];
        },
        // Capture effects so the test can run them explicitly.
        useEffect: (effect, deps) => {
            if (!captured.has('effects')) captured.set('effects', []);
            captured.get('effects').push({ effect, deps });
        },
        // Provide a mutable ref without mounting a React component.
        useRef: (initial) => ({ current: initial }),
        // Keep the callback callable without a React render cycle.
        useCallback: (callback) => callback,
    };
    const { useSortingViewport } = await loadTsxModule(viewportPath, {
        react: reactMock,
        './board': { MIN_SCALE, MAX_SCALE },
        './createSortingViewportHandlers': { createSortingViewportHandlers },
    });
    const dependencies = {
        react: reactMock,
        "react-router-dom": { useNavigate: /* Provide an inert handler for the test. */ () => noop },
        "react-toastify": { toast: { error: noop } },
        "react-toastify/dist/ReactToastify.css": {},
        "../components/Navbar": stub("navbar"),
        "../firebase": { auth: {} },
        axios: { get: /* Invoke captured.set with the test inputs. */ (path) => captured.set("axios-get", path) },
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
            // Capture wheel listener arguments without attaching a browser listener.
            useSortingWheelListener: (canvasRef, handleWheel, loading) => {
                captured.set("wheel-listener", { canvasRef, handleWheel, loading });
            },
        },
        "../features/sorting/createSortingNotesHandlers": {
            // Provide inert note handlers for any requested property.
            createSortingNotesHandlers: () => new Proxy({}, { get: /* Provide an inert handler for the test. */ () => noop }),
        },
        "../features/sorting/createBrotherSortingDetailsHandlers": {
            // Capture details dependencies and expose inert open and close handlers.
            createBrotherSortingDetailsHandlers: (options) => {
                captured.set("brother-details-options", options);
                const handlers = { openDetails:
                    /* Provide an inert open details stub for this test. */
                    () => {}, closeDetails:
                    /* Provide an inert close details stub for this test. */
                    () => {} };
                captured.set("brother-details-handlers", handlers);
                return handlers;
            },
        },
        "../features/sorting/useSortingViewerConnection": {
            // Invoke captured.set with the test inputs.
            useSortingViewerConnection: (options) => captured.set("viewer-connection", options),
        },
        "../features/sorting/loadBidCommitteeSortingData": { loadBidCommitteeSortingData: noop },
        "../features/sorting/subscribeToSortingAuth": {
            // Invoke captured.set with the test inputs.
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
        // Resolve injected test dependencies before falling back to real modules.
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromPage(specifier);
        },
    }, { filename: pagePath });

    return module.exports.default;
}

