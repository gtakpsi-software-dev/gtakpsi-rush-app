import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../src/features/voice/VoiceRecorder.tsx", import.meta.url));

async function loadRecorder({ isRecording = false, isProcessing = false, disabled = false, error = "",
    startFailure = null, stopFailure = null, blob = { id: "audio" } } = {}) {
    const calls = [];
    const updates = [];
    const transcriptions = [];
    const Recorder = await loadTsxComponent(componentPath, {
        react: {
            ...React,
            useState: () => [error, (value) => updates.push(value)],
        },
        "./useVoiceRecording": {
            useVoiceRecording: () => ({
                isRecording,
                isProcessing,
                async startRecording() {
                    calls.push("start");
                    if (startFailure) throw startFailure;
                },
                async stopRecording() {
                    calls.push("stop");
                    if (stopFailure) throw stopFailure;
                    return blob;
                },
                async transcribeAudio(value) {
                    calls.push(["transcribe", value]);
                    return "spoken answer";
                },
            }),
        },
    });
    const tree = Recorder({ disabled, onTranscription: (value) => transcriptions.push(value) });
    return { tree, calls, updates, transcriptions };
}

test("voice recorder retains idle, recording, processing, disabled, and error markup", async () => {
    const actual = {};
    for (const [name, options] of Object.entries({
        idle: {}, recording: { isRecording: true }, processing: { isProcessing: true },
        disabled: { disabled: true }, error: { error: "Microphone denied" },
    })) {
        const { tree } = await loadRecorder(options);
        const html = renderToStaticMarkup(tree);
        actual[name] = createHash("sha256").update(html).digest("hex");
    }
    assert.deepEqual(actual, {
        idle: "95c09ee182ca8636c5b9e719eb1395545dc6fbe9c57b06dc41872a23061151de",
        recording: "8196ab157108e8c8a89689cac8024ffd2fdc76c08e7cd65ef6223f7523664e10",
        processing: "a4a095d796604ef3f1eb3af3ddf7b856e712439006c47aad4d9022fe51845b08",
        disabled: "b9a2eac0530ebea3974afb6c96f79c5c53a1881dc3a9051c1ae02908384bf698",
        error: "9eb0759d55000a1f5d63515303021802751d21562c2bcfe2102717b870956fac",
    });
});

test("voice recorder starts and stops with the original transcription order", async () => {
    const idle = await loadRecorder();
    await idle.tree.props.children[0].props.onClick();
    assert.deepEqual(idle.updates, [""]);
    assert.deepEqual(idle.calls, ["start"]);

    const recording = await loadRecorder({ isRecording: true });
    await recording.tree.props.children[0].props.onClick();
    assert.deepEqual(recording.calls, ["stop", ["transcribe", { id: "audio" }]]);
    assert.deepEqual(recording.transcriptions, ["spoken answer"]);
    assert.deepEqual(recording.updates, [""]);

    const empty = await loadRecorder({ isRecording: true, blob: null });
    await empty.tree.props.children[0].props.onClick();
    assert.deepEqual(empty.calls, ["stop"]);
    assert.deepEqual(empty.transcriptions, []);
});

test("voice recorder retains disabled state and error text", async () => {
    const disabled = await loadRecorder({ disabled: true });
    assert.equal(disabled.tree.props.children[0].props.disabled, true);
    const processing = await loadRecorder({ isProcessing: true });
    assert.equal(processing.tree.props.children[0].props.disabled, true);

    const failure = await loadRecorder({ startFailure: Error("Permission denied") });
    await failure.tree.props.children[0].props.onClick();
    assert.deepEqual(failure.updates, ["", "Permission denied"]);
});
