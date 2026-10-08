import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithEsbuild } from "vite";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const pagePath = fileURLToPath(new URL("../../src/pages/Register.jsx", import.meta.url));
const hookPath = fileURLToPath(new URL("../../src/features/registration/useRegistrationFormState.js", import.meta.url));
const stagePath = fileURLToPath(new URL("../../src/features/registration/RegistrationStageView.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("../fixtures/registerPageMarkup.json", import.meta.url));
// Supply an inert callback where this test does not exercise the handler.
const noop = () => {};

// Load page with injected dependencies for isolated tests.
async function loadPage(state = {}, captured = new Map()) {
    // Create a lightweight component that captures props for assertions.
    const stub = (name) => function Stub(props) {
        // Capture component props and render a placeholder element.
        captured.set(name, props);
        return React.createElement("span", { "data-stub": name });
    };
    const basicInfo = stub("basic-info");
    const photo = stub("photo");
    const pis = stub("pis");
    const loader = stub("loader");
    const stage = existsSync(stagePath)
        ? await loadTsxComponent(stagePath, {
            "./BasicInfoForm": basicInfo,
            "./photo/PhotoCaptureStep": photo,
            "./pis/PisSignUpStep": pis,
            "../../components/Loader": loader,
        })
        : null;
    const source = (await readFile(pagePath, "utf8"))
        .replaceAll("import.meta.env.VITE_API_PREFIX", '"/api"');
    const { code } = await transformWithEsbuild(source, pagePath, {
        loader: "jsx", format: "cjs", jsx: "automatic",
    });
    const module = { exports: {} };
    const requireFromPage = createRequire(pagePath);
    let stateIndex = 0;
    const react = {
        ...React,
        // Expose controlled hook state and capture updates for assertions.
        useState(initial) {
            const index = stateIndex++;
            return [Object.hasOwn(state, index) ? state[index] : initial, noop];
        },
        // Provide a mutable ref without mounting a React component.
        useRef: () => ({ current: undefined }),
    };
    const formState = await loadTsxComponent(hookPath, { react });
    const dependencies = {
        react,
        axios: { post: noop },
        "../features/registration/BasicInfoForm": basicInfo,
        "../features/registration/photo/PhotoCaptureStep": photo,
        "../features/registration/pis/PisSignUpStep": pis,
        "../features/registration/RegistrationStageView": stage,
        "../features/registration/RegistrationSuccessView": stub("success"),
        "../features/registration/useRegistrationFormState": formState,
        "../components/Navbar": stub("navbar"),
        "../components/Loader": loader,
        "react-toastify": { toast: {} },
        "react-toastify/dist/ReactToastify.css": {},
        "react-router-dom": { useNavigate: /* Provide an inert handler for the test. */ () => noop },
        "../features/registration/registrationVerification": { verifyInfo: noop },
        "../firebase": { storage: {} },
        "firebase/storage": { ref: noop, uploadBytes: noop, getDownloadURL: noop },
        "../lib/imageProcessing": { base64ToBlob: noop },
        "../features/registration/createBasicInfoSubmit": { createBasicInfoSubmit: /* Provide an inert handler for the test. */ () => noop },
        "../features/registration/createPisSubmit": { createPisSubmit: /* Provide an inert handler for the test. */ () => noop },
    };

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

test("registration page retains each step and loading wrapper", async () => {
    // Verify registration page retains each step and loading wrapper.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const scenarios = {
        basicInfo: {},
        photo: { 10: 1 },
        pis: { 10: 2 },
        waiting: { 10: 3, 11: true },
        success: { 10: 3, 16: "12345", 18: "access-code" },
    };
    const actual = {};

    for (const [name, state] of Object.entries(scenarios)) {
        const Page = await loadPage(state);
        const html = renderToStaticMarkup(React.createElement(Page));
        actual[name] = createHash("sha256").update(html).digest("hex");
    }

    assert.deepEqual(actual, expected);
});

test("registration routes each step's state and callbacks to its view", async () => {
    // Verify registration routes each step's state and callbacks to its view.
    const photoCaptured = new Map();
    const PhotoPage = await loadPage({ 10: 1, 15: "captured-jpeg" }, photoCaptured);
    renderToStaticMarkup(React.createElement(PhotoPage));
    assert.equal(photoCaptured.get("photo").image, "captured-jpeg");
    assert.equal(typeof photoCaptured.get("photo").onContinue, "function");

    const pisCaptured = new Map();
    const selectedSlot = { time: new Date("2026-01-04T09:00:00-05:00") };
    const PisPage = await loadPage({ 10: 2, 16: selectedSlot, 17: true }, pisCaptured);
    renderToStaticMarkup(React.createElement(PisPage));
    assert.equal(pisCaptured.get("pis").selectedSlot, selectedSlot);
    assert.equal(pisCaptured.get("pis").flexWindow, true);
    assert.equal(typeof pisCaptured.get("pis").onContinue, "function");
});
