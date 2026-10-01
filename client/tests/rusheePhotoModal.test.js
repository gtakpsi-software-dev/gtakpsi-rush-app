import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../src/features/rushee/self/RusheePhotoModal.jsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("./fixtures/rusheePhotoModal.json", import.meta.url));
const webcamRef = { current: null };

const WebcamMock = () => React.createElement("div", { "data-mock-webcam": true });

function props(overrides = {}) {
    return {
        showPreview: false,
        image: "data:image/jpeg;base64,AAA",
        webcamRef,
        onClose() {},
        onRetake() {},
        onSave() {},
        onCapture() {},
        ...overrides,
    };
}

function collect(node, elements = []) {
    if (Array.isArray(node)) {
        node.forEach((child) => collect(child, elements));
    } else if (React.isValidElement(node)) {
        elements.push(node);
        collect(node.props.children, elements);
    }
    return elements;
}

async function loadModal() {
    return loadTsxComponent(componentPath, { "react-webcam": WebcamMock });
}

test("camera and preview retain the original photo modal markup", async () => {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const RusheePhotoModal = await loadModal();
    for (const [name, showPreview] of [["camera", false], ["preview", true]]) {
        const html = renderToStaticMarkup(React.createElement(RusheePhotoModal, props({ showPreview })));
        assert.equal(createHash("sha256").update(html).digest("hex"), expected[name]);
    }
});

test("modal retains close, capture, retake, and save callbacks and webcam settings", async () => {
    const RusheePhotoModal = await loadModal();
    const calls = [];
    const callbacks = {
        onClose: () => calls.push("close"),
        onCapture: () => calls.push("capture"),
        onRetake: () => calls.push("retake"),
        onSave: () => calls.push("save"),
    };
    const camera = collect(RusheePhotoModal(props(callbacks)));
    const cameraButtons = camera.filter((node) => node.type === "button");
    const webcam = camera.find((node) => node.type === WebcamMock);
    assert.equal(webcam.props.audio, false);
    assert.equal(webcam.props.screenshotFormat, "image/jpeg");
    assert.equal(webcam.ref, webcamRef);
    cameraButtons[0].props.onClick();
    cameraButtons[1].props.onClick();

    const preview = collect(RusheePhotoModal(props({ ...callbacks, showPreview: true })));
    const previewButtons = preview.filter((node) => node.type === "button");
    previewButtons[1].props.onClick();
    previewButtons[2].props.onClick();
    assert.deepEqual(calls, ["close", "capture", "retake", "save"]);
});
