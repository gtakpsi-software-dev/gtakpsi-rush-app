import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import React from "react";
import { transformWithEsbuild } from "vite";
import { loadTsxComponent } from "./loadTsxComponent.js";
import {
    getVisibleComments, hasOwnComment, shouldShowAllComments,
} from "../../src/features/comments/commentVisibility.js";
import {
    getRusheeNumber, isBidCommitteeMode,
} from "../../src/features/rushee/zoom/routeContext.js";
import {
    RATING_FIELDS, createDefaultRatings, createDefaultNotSeen,
} from "../../src/features/rushee/zoom/commentRatingDefaults.js";

const pagePath = fileURLToPath(new URL("../../src/pages/RusheeZoom.jsx", import.meta.url));
const viewPath = fileURLToPath(new URL("../../src/features/rushee/zoom/RusheeCommentsView.tsx", import.meta.url));
const actionsPath = fileURLToPath(new URL("../../src/features/rushee/zoom/RusheeActions.tsx", import.meta.url));
const layoutPath = fileURLToPath(new URL("../../src/features/rushee/zoom/RusheeZoomView.tsx", import.meta.url));
const accessPath = fileURLToPath(new URL("../../src/features/rushee/zoom/useRusheeZoomAccess.js", import.meta.url));

// Load rushee zoom page with injected dependencies for isolated tests.
export async function loadRusheeZoomPage(state = {}, captured = new Map(), runtime = {}) {
    // Create a lightweight component that captures props for assertions.
    const stub = (name) => function Stub(props) {
        // Capture component props and render a placeholder element.
        captured.set(name, props);
        return React.createElement("span", { "data-stub": name });
    };
    const View = await loadTsxComponent(viewPath, {
        "./NewCommentForm": stub("new-comment"),
        "./ExistingCommentList": stub("existing-comments"),
    });
    const Actions = await loadTsxComponent(actionsPath, {});
    // Capture comments-view props before rendering the real component.
    const ViewWithCapture = (props) => {
        captured.set("comments-view", props);
        return React.createElement(View, props);
    };
    // Capture action props before rendering the real component.
    const ActionsWithCapture = (props) => {
        captured.set("actions", props);
        return React.createElement(Actions, props);
    };
    const Layout = await loadTsxComponent(layoutPath, {
        "../../../components/Navbar": stub("navbar"),
        "./ZoomModals": stub("modals"),
        "./RusheeProfileHeader": stub("header"),
        "./RusheeRatings": stub("ratings"),
        "./RusheePisDetails": stub("pis-details"),
        "./RusheeCommentsView": ViewWithCapture,
        "./RusheeActions": ActionsWithCapture,
    });
    // Supply an inert callback where this test does not exercise the handler.
    const noop = () => {};
    let stateIndex = 0;
    // Provide inert action handlers for any requested property.
    const actions = () => new Proxy({}, { get: /* Provide an inert handler for the test. */ () => noop });
    const reactHooks = {
        ...React,
        // Expose controlled hook state and capture updates for assertions.
        useState(initial) {
            const index = stateIndex++;
            const value = Object.hasOwn(state, index)
                ? state[index]
                : typeof initial === "function" ? initial() : initial;
            return [value, /* Forward state updates to the optional runtime observer. */ (next) => runtime.onStateChange?.(index, next)];
        },
        useEffect: noop,
    };
    const useRusheeZoomAccess = await loadTsxComponent(accessPath, {
        react: reactHooks,
        axios: {},
        "../../../firebase": { auth: {} },
        "../../comments/commentVisibility": {
            getVisibleComments, hasOwnComment, shouldShowAllComments,
        },
        "../../auth/verifyUser": { verifyUser: noop },
        "./loadRusheeZoom": { loadRusheeZoom: noop },
    });
    const dependencies = {
        react: reactHooks,
        axios: {},
        "react-router-dom": {
            // Provide an inert handler for the test.
            useNavigate: () => noop,
            // Return the route-parameter fixture for this scenario.
            useParams: () => ({ gtid: "123" }),
            // Return the route-location fixture for this scenario.
            useLocation: () => ({ pathname: "/brother/rushee/123", search: "" }),
        },
        "../features/rushee/zoom/commentCreateActions": { createCommentCreateActions: actions },
        "../features/rushee/zoom/existingCommentActions": { createExistingCommentActions: actions },
        "../features/rushee/zoom/useRusheeZoomAccess": useRusheeZoomAccess,
        "../features/rushee/zoom/RusheeZoomView": Layout,
        "../features/rushee/zoom/routeContext": { getRusheeNumber, isBidCommitteeMode },
        "../features/rushee/zoom/commentRatingDefaults": {
            RATING_FIELDS, createDefaultRatings, createDefaultNotSeen,
        },
        "../components/Loader": stub("loader"),
        "../features/comments/commentValidation": { validateComment: noop, generateWarnings: noop },
        "react-toastify": { toast: {} },
        "react-toastify/dist/ReactToastify.css": {},
    };
    const source = (await readFile(pagePath, "utf8"))
        .replaceAll("import.meta.env.VITE_API_PREFIX", '"/api"');
    const { code } = await transformWithEsbuild(source, pagePath, {
        loader: "jsx", format: "cjs", jsx: "automatic",
    });
    const module = { exports: {} };
    const requireFromPage = createRequire(pagePath);

    runInNewContext(code, {
        module,
        exports: module.exports,
        localStorage: { getItem: /* Return the fixed item fixture. */ () => '{"firstname":"Sam","lastname":"Brother"}' },
        document: { referrer: "" },
        ...runtime.globals,
        // Resolve injected test dependencies before falling back to real modules.
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromPage(specifier);
        },
    }, { filename: pagePath });

    return module.exports.default;
}
