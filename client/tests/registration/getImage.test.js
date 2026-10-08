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

const componentPath = fileURLToPath(new URL("../../src/features/registration/photo/PhotoCaptureStep.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("../fixtures/getImageMarkup.json", import.meta.url));

// Load component with injected dependencies for isolated tests.
async function loadComponent({ showPreview = false, document = {}, setPreview = /* Leave this mocked callback inert. */ () => {} } = {}) {
    const source = await readFile(componentPath, "utf8");
    const { code } = await transformWithEsbuild(source, componentPath, {
        loader: "tsx", format: "cjs", jsx: "automatic",
    });
    const module = { exports: {} };
    const requireFromComponent = createRequire(componentPath);

    runInNewContext(code, {
        module,
        exports: module.exports,
        document,
        // Resolve injected test dependencies before falling back to real modules.
        require(specifier) {
            if (specifier === "react") {
                return { ...React, useState: /* Expose controlled hook state and capture updates for assertions. */ () => [showPreview, setPreview] };
            }
            if (specifier === "react-webcam") {
                return function WebcamStub() {
                    // Render a lightweight React element for component assertions.
                    return React.createElement("span", { "data-webcam": "" });
                };
            }
            return requireFromComponent(specifier);
        },
    }, { filename: componentPath });

    return module.exports.default;
}

// Find the button with the requested label.
function findButton(node, text) {
    if (Array.isArray(node)) return node.map(/* Invoke findButton with the test inputs. */ (item) => findButton(item, text)).find(Boolean);
    if (!React.isValidElement(node)) return null;
    if (node.type === "button" && node.props.children === text) return node;
    return findButton(node.props.children, text);
}

test("registration camera keeps its original capture and preview markup", async () => {
    // Verify registration camera keeps its original capture and preview markup.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const actual = {};

    for (const [name, showPreview] of [["camera", false], ["preview", true]]) {
        const PhotoCaptureStep = await loadComponent({ showPreview });
        const html = renderToStaticMarkup(React.createElement(PhotoCaptureStep, {
            webcamRef: { current: null },
            image: "data:image/jpeg;base64,preview",
            // Provide an inert set image stub for this test.
            setImage() {},
            // Provide an inert on continue stub for this test.
            onContinue() {},
        }));
        actual[name] = createHash("sha256").update(html).digest("hex");
    }

    assert.deepEqual(actual, expected);
});

test("capture mirrors the video frame and passes its JPEG to the preview", async () => {
    // Verify capture mirrors the video frame and passes its JPEG to the preview.
    const calls = [];
    const video = {};
    const context = {
        // Record scale calls for assertions.
        scale: (...args) => calls.push(["scale", ...args]),
        // Record translate calls for assertions.
        translate: (...args) => calls.push(["translate", ...args]),
        // Record draw image calls for assertions.
        drawImage: (...args) => calls.push(["drawImage", ...args]),
    };
    const canvas = {
        // Record canvas context lookup and return the drawing context fixture.
        getContext: (kind) => {
            calls.push(["getContext", kind]);
            return context;
        },
        // Record image encoding arguments and return the captured image fixture.
        toDataURL: (...args) => {
            calls.push(["toDataURL", ...args]);
            return "captured-jpeg";
        },
    };
    const document = {
        // Record element creation and return the fake canvas.
        createElement: (tag) => {
            calls.push(["createElement", tag]);
            return canvas;
        },
    };
    const PhotoCaptureStep = await loadComponent({
        document,
        // Record set preview calls for assertions.
        setPreview: (value) => calls.push(["setPreview", value]),
    });
    const tree = PhotoCaptureStep({
        webcamRef: { current: { video } },
        // Record set image calls for assertions.
        setImage: (value) => calls.push(["setImage", value]),
    });

    findButton(tree, "Take Photo").props.onClick();

    assert.equal(canvas.width, 1280);
    assert.equal(canvas.height, 1280);
    assert.deepEqual(calls, [
        ["createElement", "canvas"],
        ["getContext", "2d"],
        ["scale", -1, 1],
        ["translate", -1280, 0],
        ["drawImage", video, 0, 0, 1280, 1280],
        ["toDataURL", "image/jpeg", 0.95],
        ["setPreview", true],
        ["setImage", "captured-jpeg"],
    ]);
});

test("preview keeps retake and continue actions wired to the caller", async () => {
    // Verify preview keeps retake and continue actions wired to the caller.
    const previewChanges = [];
    // Provide an inert on continue stub for this test.
    const onContinue = () => {};
    const PhotoCaptureStep = await loadComponent({
        showPreview: true,
        // Record set preview calls for assertions.
        setPreview: (value) => previewChanges.push(value),
    });
    const tree = PhotoCaptureStep({ image: "captured-jpeg", onContinue });

    findButton(tree, "Retake Photo").props.onClick();
    assert.deepEqual(previewChanges, [false]);
    assert.equal(findButton(tree, "Continue").props.onClick, onContinue);
});
