import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../../helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../../../src/features/rushee/self/RusheePhotoModal.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("../../fixtures/rusheePhotoModal.json", import.meta.url));
const webcamRef = { current: null };

// Render a lightweight React element for component assertions.
const WebcamMock = () => React.createElement("div", { "data-mock-webcam": true });

// Build component props with test-specific overrides.
function props(overrides = {}) {
    return {
        showPreview: false,
        image: "data:image/jpeg;base64,AAA",
        webcamRef,
        // Provide an inert on close stub for this test.
        onClose() {},
        // Provide an inert on retake stub for this test.
        onRetake() {},
        // Provide an inert on save stub for this test.
        onSave() {},
        // Provide an inert on capture stub for this test.
        onCapture() {},
        ...overrides,
    };
}

// Walk the rendered element tree to collect nodes for assertions.
function collect(node, elements = []) {
    if (Array.isArray(node)) {
        node.forEach(/* Invoke collect with the test inputs. */ (child) => collect(child, elements));
    } else if (React.isValidElement(node)) {
        elements.push(node);
        collect(node.props.children, elements);
    }
    return elements;
}

// Load modal with injected dependencies for isolated tests.
async function loadModal() {
    return loadTsxComponent(componentPath, { "react-webcam": WebcamMock });
}

test("camera and preview retain the original photo modal markup", async () => {
    // Verify camera and preview retain the original photo modal markup.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const RusheePhotoModal = await loadModal();
    for (const [name, showPreview] of [["camera", false], ["preview", true]]) {
        const html = renderToStaticMarkup(React.createElement(RusheePhotoModal, props({ showPreview })));
        assert.equal(createHash("sha256").update(html).digest("hex"), expected[name]);
    }
});

test("modal retains close, capture, retake, and save callbacks and webcam settings", async () => {
    // Verify modal retains close, capture, retake, and save callbacks and webcam settings.
    const RusheePhotoModal = await loadModal();
    const calls = [];
    const callbacks = {
        // Record on close calls for assertions.
        onClose: () => calls.push("close"),
        // Record on capture calls for assertions.
        onCapture: () => calls.push("capture"),
        // Record on retake calls for assertions.
        onRetake: () => calls.push("retake"),
        // Record on save calls for assertions.
        onSave: () => calls.push("save"),
    };
    const camera = collect(RusheePhotoModal(props(callbacks)));
    const cameraButtons = camera.filter(/* Identify rendered button elements. */ (node) => node.type === "button");
    const webcam = camera.find(/* Match node.type to WebcamMock. */ (node) => node.type === WebcamMock);
    assert.equal(webcam.props.audio, false);
    assert.equal(webcam.props.screenshotFormat, "image/jpeg");
    assert.equal(webcam.ref, webcamRef);
    cameraButtons[0].props.onClick();
    cameraButtons[1].props.onClick();

    const preview = collect(RusheePhotoModal(props({ ...callbacks, showPreview: true })));
    const previewButtons = preview.filter(/* Identify rendered button elements. */ (node) => node.type === "button");
    previewButtons[1].props.onClick();
    previewButtons[2].props.onClick();
    assert.deepEqual(calls, ["close", "capture", "retake", "save"]);
});
