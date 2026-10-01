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

const pagePath = fileURLToPath(new URL("../src/pages/FaceAttendance.jsx", import.meta.url));

async function loadPage({ state = {}, modelFailure = false, getFailure = false, getResponse } = {}) {
    const updates = [];
    const requests = [];
    const warnings = [];
    const navigations = [];
    const modelCalls = [];
    const logs = [];
    let stateIndex = 0;
    const source = (await readFile(pagePath, "utf8"))
        .replaceAll("import.meta.env.VITE_API_PREFIX", '"/api"');
    const { code } = await transformWithEsbuild(source, pagePath, {
        loader: "jsx", format: "cjs", jsx: "automatic",
    });
    const module = { exports: {} };
    const requireFromPage = createRequire(pagePath);
    const model = {
        infer(tensor, layer) {
            modelCalls.push(["infer", tensor, layer]);
            return { dataSync: () => new Float32Array([1, 2]) };
        },
    };
    const WebcamStub = React.forwardRef(function WebcamStub() {
        return React.createElement("span", { "data-stub": "webcam" });
    });
    function LoaderStub() {
        return React.createElement("span", { "data-stub": "loader" });
    }

    runInNewContext(code, {
        module,
        exports: module.exports,
        console: { log: (value) => logs.push(value) },
        require(specifier) {
            const dependencies = {
                react: {
                    ...React,
                    useState(initial) {
                        const index = stateIndex++;
                        return [Object.hasOwn(state, index) ? state[index] : initial,
                            (value) => updates.push([index, value])];
                    },
                    useRef: () => ({ current: { getScreenshot: () => "data:image/jpeg;base64,photo" } }),
                },
                "react-webcam": WebcamStub,
                "@tensorflow/tfjs": {},
                "@tensorflow-models/mobilenet": {
                    async load() {
                        modelCalls.push(["load"]);
                        if (modelFailure) throw Error("model offline");
                        return model;
                    },
                },
                "../components/Loader": LoaderStub,
                axios: {
                    async get(url, vector) {
                        requests.push([url, vector]);
                        if (getFailure) throw Error("network offline");
                        return getResponse ?? { data: { status: "success", payload: { id: "r1" } } };
                    },
                },
                "react-router-dom": { useNavigate: () => (path) => navigations.push(path) },
                "../lib/imageProcessing": {
                    async base64ToTensor(image, loadedModel) {
                        modelCalls.push(["tensor", image, loadedModel === model]);
                        return "tensor";
                    },
                },
                "react-toastify": { toast: { warn: (message) => warnings.push(message) } },
                "react-toastify/dist/ReactToastify.css": {},
            };
            return Object.hasOwn(dependencies, specifier)
                ? dependencies[specifier]
                : requireFromPage(specifier);
        },
    }, { filename: pagePath });

    return { Page: module.exports.default, updates, requests, warnings, navigations, modelCalls, logs };
}

function collect(node, elements = []) {
    if (!React.isValidElement(node)) return elements;
    elements.push(node);
    React.Children.forEach(node.props.children, (child) => collect(child, elements));
    return elements;
}

test("face attendance retains camera, preview, loading, and completed markup", async () => {
    const actual = {};
    for (const [name, state] of Object.entries({
        camera: {}, preview: { 1: true, 2: "data:image/jpeg;base64,photo" },
        loading: { 3: true }, complete: { 0: 1 },
    })) {
        const { Page } = await loadPage({ state });
        const html = renderToStaticMarkup(React.createElement(Page));
        actual[name] = createHash("sha256").update(html).digest("hex");
    }
    assert.deepEqual(actual, {
        camera: "109b3a665af34c7c98a678b040725c32118fff04f5077dbdc6620440268d686b",
        preview: "80fe318ca6e4f1a2067633ff602b9321020760313108ec9f1e7964572bc022c2",
        loading: "633c684af2f5a1a4f6f655b33ef320e890e034052d2aad907ea9f3456ad6e5dc",
        complete: "2342e3cd4e358892c31348cfcd20b2b45439f1ec84b029715f14ba1844463dd6",
    });
});

test("camera capture, retake, and submit retain their state and request order", async () => {
    const camera = await loadPage();
    const capture = collect(camera.Page()).find((node) => node.type === "button");
    capture.props.onClick();
    assert.deepEqual(camera.updates, [[1, true], [2, "data:image/jpeg;base64,photo"]]);

    const preview = await loadPage({ state: { 1: true, 2: "photo" } });
    const buttons = collect(preview.Page()).filter((node) => node.type === "button");
    buttons[0].props.onClick();
    assert.deepEqual(preview.updates, [[1, false]]);
    await buttons[1].props.onClick();
    assert.deepEqual(preview.modelCalls.slice(0, 3), [
        ["load"], ["tensor", "photo", true], ["infer", "tensor", "conv_preds"],
    ]);
    assert.deepEqual(JSON.parse(JSON.stringify(preview.requests)), [
        ["/api/rushee/get-rushee-face", [1, 2]],
    ]);
    assert.deepEqual(JSON.parse(JSON.stringify(preview.updates)), [
        [1, false], [3, true], [0, 1], [4, { id: "r1" }], [3, false],
    ]);
});

test("model failure retains error navigation and the current loading state", async () => {
    const page = await loadPage({ state: { 1: true, 2: "photo" }, modelFailure: true });
    const submit = collect(page.Page()).find((node) => node.type === "button" && node.props.children === "Submit Photo");
    await submit.props.onClick();
    assert.deepEqual(page.requests, []);
    assert.deepEqual(page.updates, [[3, true]]);
    assert.deepEqual(page.navigations, [
        "/error/Couldn't Process your Face/While vectorizing your face, there was an issue.",
    ]);
});

test("lookup status and network failures retain their warning messages", async () => {
    for (const [options, expected] of [
        [{ getResponse: { data: { status: "error", message: "Not found" } } }, "Not found"],
        [{ getFailure: true }, "Some internal error occurred"],
    ]) {
        const page = await loadPage({ state: { 1: true, 2: "photo" }, ...options });
        const submit = collect(page.Page()).find((node) => node.type === "button" && node.props.children === "Submit Photo");
        await submit.props.onClick();
        assert.deepEqual(page.warnings, [expected]);
        assert.deepEqual(page.updates, [[3, true], [3, false]]);
    }
});
