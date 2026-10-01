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
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";
import {
    getVisibleComments, hasOwnComment, shouldShowAllComments,
} from "../src/js/commentVisibility.js";

const pagePath = fileURLToPath(new URL("../src/pages/RusheeZoom.jsx", import.meta.url));
const viewPath = fileURLToPath(new URL("../src/features/rushee/zoom/RusheeCommentsView.tsx", import.meta.url));
const actionsPath = fileURLToPath(new URL("../src/features/rushee/zoom/RusheeActions.tsx", import.meta.url));
const layoutPath = fileURLToPath(new URL("../src/features/rushee/zoom/RusheeZoomView.tsx", import.meta.url));
const accessPath = fileURLToPath(new URL("../src/features/rushee/zoom/useRusheeZoomAccess.js", import.meta.url));
const fixturePath = fileURLToPath(new URL("./fixtures/rusheeZoomPageMarkup.json", import.meta.url));

const rushee = {
    gtid: "123", access_code: "edit", comments: [{ brother_name: "Other Brother" }],
};

async function loadPage(state = {}, captured = new Map()) {
    const stub = (name) => function Stub(props) {
        captured.set(name, props);
        return React.createElement("span", { "data-stub": name });
    };
    const View = await loadTsxComponent(viewPath, {
        "./NewCommentForm": stub("new-comment"),
        "./ExistingCommentList": stub("existing-comments"),
    });
    const Actions = await loadTsxComponent(actionsPath, {});
    const ViewWithCapture = (props) => {
        captured.set("comments-view", props);
        return React.createElement(View, props);
    };
    const Layout = await loadTsxComponent(layoutPath, {
        "../../../components/Navbar": stub("navbar"),
        "./ZoomModals": stub("modals"),
        "./RusheeProfileHeader": stub("header"),
        "./RusheeRatings": stub("ratings"),
        "./RusheePisDetails": stub("pis-details"),
        "./RusheeCommentsView": ViewWithCapture,
        "./RusheeActions": Actions,
    });
    const noop = () => {};
    let stateIndex = 0;
    const actions = () => new Proxy({}, { get: () => noop });
    const reactHooks = {
        ...React,
        useState(initial) {
            const index = stateIndex++;
            const value = Object.hasOwn(state, index)
                ? state[index]
                : typeof initial === "function" ? initial() : initial;
            return [value, noop];
        },
        useEffect: noop,
    };
    const useRusheeZoomAccess = await loadTsxComponent(accessPath, {
        react: reactHooks,
        axios: {},
        "../../../firebase": { auth: {} },
        "../../../js/commentVisibility": {
            getVisibleComments, hasOwnComment, shouldShowAllComments,
        },
        "../../auth/verifyUser": { verifyUser: noop },
        "./loadRusheeZoom": { loadRusheeZoom: noop },
    });
    const dependencies = {
        react: reactHooks,
        axios: {},
        "react-router-dom": {
            useNavigate: () => noop,
            useParams: () => ({ gtid: "123" }),
            useLocation: () => ({ pathname: "/brother/rushee/123", search: "" }),
        },
        "../features/rushee/zoom/commentCreateActions": { createCommentCreateActions: actions },
        "../features/rushee/zoom/existingCommentActions": { createExistingCommentActions: actions },
        "../features/rushee/zoom/useRusheeZoomAccess": useRusheeZoomAccess,
        "../features/rushee/zoom/RusheeZoomView": Layout,
        "../components/Loader": stub("loader"),
        "../js/speculativeWordBank": { validateComment: noop, generateWarnings: noop },
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
        localStorage: { getItem: () => '{"firstname":"Sam","lastname":"Brother"}' },
        document: { referrer: "" },
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromPage(specifier);
        },
    }, { filename: pagePath });

    return module.exports.default;
}

test("rushee zoom retains loading, admin, copied-link, and restricted markup", async () => {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const scenarios = {
        loading: {},
        admin: { 0: false, 8: rushee, 15: true },
        copied: { 0: false, 8: rushee, 15: true, 18: true },
        restricted: { 0: false, 8: rushee },
    };
    const actual = {};

    for (const [name, state] of Object.entries(scenarios)) {
        const Page = await loadPage(state);
        const html = renderToStaticMarkup(React.createElement(Page));
        actual[name] = createHash("sha256").update(html).digest("hex");
    }
    assert.deepEqual(actual, expected);
});

test("comment view receives the original visibility and form/list props", async () => {
    const admin = new Map();
    const AdminPage = await loadPage({ 0: false, 8: rushee, 15: true }, admin);
    renderToStaticMarkup(React.createElement(AdminPage));
    assert.equal(admin.get("comments-view").rusheeComments, rushee.comments);
    assert.equal(admin.get("comments-view").showAllComments, true);
    assert.equal(admin.get("comments-view").showVisibilityNotice, false);
    assert.equal(admin.get("new-comment").ratingFields.length, 4);
    assert.equal(typeof admin.get("new-comment").handleSubmitComment, "function");
    assert.equal(admin.get("existing-comments").visibleComments, rushee.comments);

    const restricted = new Map();
    const RestrictedPage = await loadPage({ 0: false, 8: rushee }, restricted);
    renderToStaticMarkup(React.createElement(RestrictedPage));
    assert.equal(restricted.get("comments-view").showAllComments, false);
    assert.equal(restricted.get("comments-view").showVisibilityNotice, true);
    assert.deepEqual(restricted.get("existing-comments").visibleComments, []);
});
