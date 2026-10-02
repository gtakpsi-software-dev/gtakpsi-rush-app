import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithEsbuild } from "vite";
import { createAttendanceActions } from "../../src/features/attendance/createAttendanceActions.js";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const pagePath = fileURLToPath(new URL("../../src/pages/Attendance.jsx", import.meta.url));
const viewPath = fileURLToPath(new URL("../../src/features/attendance/AttendanceView.tsx", import.meta.url));

async function loadPage({ state = {}, getResponse, postResponse, getFailure = false, postFailure = false } = {}) {
    const updates = [];
    const requests = [];
    const errors = [];
    const effects = [];
    const captured = new Map();
    const navigate = () => {};
    let stateIndex = 0;
    const source = (await readFile(pagePath, "utf8"))
        .replaceAll("import.meta.env.VITE_API_PREFIX", '"/api"');
    const { code } = await transformWithEsbuild(source, pagePath, {
        loader: "jsx", format: "cjs", jsx: "automatic",
    });
    const module = { exports: {} };
    const requireFromPage = createRequire(pagePath);
    const stub = (name) => {
        function Stub(props) {
            captured.set(name, props);
            return React.createElement("span", { "data-stub": name });
        }
        Stub.displayName = name;
        return Stub;
    };
    const AttendanceView = await loadTsxComponent(viewPath, {
        "../../components/Loader": stub("loader"),
        "./SplashPage": stub("splash"),
        "./DisplayInfo": stub("info"),
        "./SuccessPage": stub("success"),
    });

    runInNewContext(code, {
        module,
        exports: module.exports,
        console: { log() {} },
        require(specifier) {
            const dependencies = {
                react: {
                    ...React,
                    useState(initial) {
                        const index = stateIndex++;
                        return [Object.hasOwn(state, index) ? state[index] : initial,
                            (value) => updates.push([index, value])];
                    },
                    useEffect(callback, dependencies) {
                        effects.push({ callback, dependencies });
                    },
                },
                "../features/attendance/AttendanceView": AttendanceView,
                "react-toastify": { toast: { error: (message, options) => errors.push([message, options]) } },
                "react-toastify/dist/ReactToastify.css": {},
                "../features/registration/registrationVerification": {},
                "../features/auth/verifyUser": { verifyUser: async () => true },
                "../features/attendance/createAttendanceActions": { createAttendanceActions },
                axios: {
                    get: async (url) => {
                        requests.push(["get", url]);
                        if (getFailure) throw new Error("network offline");
                        return getResponse ?? { data: { status: "success", payload: { gtid: "123" } } };
                    },
                    post: async (url) => {
                        requests.push(["post", url]);
                        if (postFailure) throw new Error("network offline");
                        return postResponse ?? { data: { status: "success" } };
                    },
                },
                "react-router-dom": { useNavigate: () => navigate },
            };
            return Object.hasOwn(dependencies, specifier)
                ? dependencies[specifier]
                : requireFromPage(specifier);
        },
    }, { filename: pagePath });

    return { Page: module.exports.default, captured, updates, requests, errors, effects, navigate };
}

function renderBranch(page) {
    let element = page.Page();
    element = element.type(element.props);
    while (typeof element.type === "string") {
        element = element.props.children;
    }
    return element;
}

test("attendance keeps its wrapper markup and fetch-effect dependencies", async () => {
    for (const [state, expected] of [
        [{}, '<div><div><span data-stub="splash"></span></div></div>'],
        [{ 2: true }, '<div><span data-stub="loader"></span></div>'],
        [{ 1: 1 }, '<div><div><div><span data-stub="info"></span></div></div></div>'],
        [{ 1: 2 }, '<div><div><div><span data-stub="success"></span></div></div></div>'],
    ]) {
        const page = await loadPage({ state });
        assert.equal(renderToStaticMarkup(React.createElement(page.Page)), expected);
        assert.equal(page.effects.length, 1);
        assert.deepEqual(Array.from(page.effects[0].dependencies), ["/api", state[2], page.navigate]);
    }
});

test("attendance retains its splash, loading, confirmation, and success branches", async () => {
    for (const [state, expected] of [
        [{}, "splash"], [{ 2: true }, "loader"],
        [{ 1: 1, 3: { name: "Rushee" } }, "info"], [{ 1: 2 }, "success"],
    ]) {
        const page = await loadPage({ state });
        const element = renderBranch(page);
        assert.equal(element.type.displayName, expected);
        assert.equal(page.captured.size, 0);
    }
});

test("attendance lookup, check-in, and back retain their state transitions", async () => {
    const splash = await loadPage({ state: { 0: "123" } });
    const splashElement = renderBranch(splash);
    await splashElement.props.func();
    assert.deepEqual(splash.requests, [["get", "/api/rushee/123"]]);
    assert.deepEqual(JSON.parse(JSON.stringify(splash.updates)), [
        [2, true], [1, 1], [3, { gtid: "123" }], [2, false],
    ]);

    const info = await loadPage({ state: { 0: "123", 1: 1, 3: { gtid: "123" } } });
    const infoElement = renderBranch(info);
    await infoElement.props.checkIn();
    assert.deepEqual(info.requests, [["post", "/api/rushee/update-attendance/123"]]);
    assert.deepEqual(info.updates, [[2, true], [1, 2], [2, false]]);
    infoElement.props.goBack();
    assert.deepEqual(info.updates.slice(-3), [[0, undefined], [1, 0], [3, undefined]]);
});

test("attendance lookup and check-in retain their toast options on API errors", async () => {
    for (const [state, response, action] of [
        [{ 0: "123" }, { data: { status: "error", message: "Not found" } }, "func"],
        [{ 0: "123", 1: 1 }, { data: { status: "error", message: "Already checked in" } }, "checkIn"],
    ]) {
        const page = await loadPage({
            state,
            getResponse: response,
            postResponse: response,
        });
        await renderBranch(page).props[action]();
        assert.deepEqual(JSON.parse(JSON.stringify(page.errors)), [[response.data.message, {
            position: "top-center", autoClose: 5000, hideProgressBar: false,
            closeOnClick: true, pauseOnHover: true, draggable: true,
            theme: "dark",
        }]]);
        assert.equal(Object.hasOwn(page.errors[0][1], "progress"), true);
        assert.equal(page.errors[0][1].progress, undefined);
    }
});

test("attendance network failures retain their shared toast and loading reset", async () => {
    for (const [state, options, action] of [
        [{ 0: "123" }, { getFailure: true }, "func"],
        [{ 0: "123", 1: 1 }, { postFailure: true }, "checkIn"],
    ]) {
        const page = await loadPage({ state, ...options });
        await renderBranch(page).props[action]();
        assert.equal(page.errors[0][0], "Some internal network error occurred");
        assert.deepEqual(page.updates, [[2, true], [2, false]]);
    }
});
