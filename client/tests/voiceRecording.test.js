import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { transformWithEsbuild } from "vite";
import { requestTranscription } from "../src/features/voice/requestTranscription.js";

const hookPath = fileURLToPath(new URL("../src/features/voice/useVoiceRecording.js", import.meta.url));

async function loadHook({
    isRecording = false,
    microphoneFailure = null,
    apiKey = "test-key",
    transcriptionResponse = { ok: true, json: async () => ({ text: "spoken answer" }) },
} = {}) {
    const calls = [];
    const updates = [];
    const logs = [];
    const window = {};
    const source = (await readFile(hookPath, "utf8"))
        .replaceAll("import.meta.env.VITE_OPENAI_API_KEY", JSON.stringify(apiKey));
    const { code } = await transformWithEsbuild(source, hookPath, {
        loader: "js", format: "cjs",
    });
    const module = { exports: {} };
    let stateIndex = 0;
    let recorder;
    const stream = {
        getTracks: () => [{ stop: () => calls.push(["stop-track"]) }],
    };
    class MediaRecorderStub {
        constructor(value, options) {
            calls.push(["recorder", options.mimeType]);
            this.stream = value;
            recorder = this;
        }
        start() { calls.push(["start"]); }
        stop() {
            calls.push(["stop"]);
            this.onstop();
        }
    }
    class FileStub {
        constructor(parts, name, options) {
            this.parts = parts;
            this.name = name;
            this.type = options.type;
        }
    }
    class FormDataStub {
        fields = [];
        append(name, value) { this.fields.push([name, value]); }
    }
    const web = {
        File: FileStub,
        FormData: FormDataStub,
        async fetch(url, options) {
            calls.push(["fetch", url, options]);
            return transcriptionResponse;
        },
    };

    runInNewContext(code, {
        module,
        exports: module.exports,
        Blob,
        File: FileStub,
        FormData: FormDataStub,
        MediaRecorder: MediaRecorderStub,
        window,
        navigator: {
            mediaDevices: {
                async getUserMedia(constraints) {
                    calls.push(["microphone", JSON.parse(JSON.stringify(constraints))]);
                    if (microphoneFailure) throw microphoneFailure;
                    return stream;
                },
            },
        },
        console: { error: (...args) => logs.push(args) },
        require(specifier) {
            if (specifier === "./requestTranscription") {
                return { requestTranscription: (blob, key) => requestTranscription(blob, key, web) };
            }
            if (specifier === "react") {
                return {
                    useState(initial) {
                        const index = stateIndex++;
                        return [index === 0 ? isRecording : initial,
                            (value) => updates.push([index, value])];
                    },
                    useRef: (initial) => ({ current: initial }),
                    useCallback: (callback) => callback,
                };
            }
            throw Error(`Unexpected dependency: ${specifier}`);
        },
    }, { filename: hookPath });

    return { hook: module.exports.useVoiceRecording(), calls, updates, logs, window, getRecorder: () => recorder };
}

test("voice hook retains microphone options, chunks, and track cleanup", async () => {
    const context = await loadHook({ isRecording: true });
    await context.hook.startRecording();
    assert.deepEqual(context.calls.slice(0, 3), [
        ["microphone", { audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 } }],
        ["recorder", "audio/webm;codecs=opus"], ["start"],
    ]);
    context.getRecorder().ondataavailable({ data: new Blob(["sound"]) });
    const blob = await context.hook.stopRecording();
    assert.equal(blob.type, "audio/webm;codecs=opus");
    assert.equal(blob.size, 5);
    assert.deepEqual(context.calls.slice(-2), [["stop"], ["stop-track"]]);
    assert.deepEqual(context.updates, [[0, true], [0, false]]);
});

test("voice hook retains transcription request and processing state order", async () => {
    const context = await loadHook();
    const result = await context.hook.transcribeAudio(new Blob(["sound"]));
    assert.equal(result, "spoken answer");
    const [kind, url, options] = context.calls.find(([event]) => event === "fetch");
    assert.equal(kind, "fetch");
    assert.equal(url, "https://api.openai.com/v1/audio/transcriptions");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer test-key");
    assert.deepEqual(options.body.fields.map(([name]) => name), ["file", "model", "language"]);
    assert.equal(options.body.fields[0][1].name, "recording.webm");
    assert.equal(options.body.fields[1][1], "whisper-1");
    assert.equal(options.body.fields[2][1], "en");
    assert.deepEqual(context.updates, [[1, true], [1, false]]);
});

test("record-and-transcribe retains the microphone failure error", async () => {
    const context = await loadHook({ microphoneFailure: Error("denied") });
    await assert.rejects(context.hook.recordAndTranscribe(), {
        message: "Failed to start recording. Please check microphone permissions.",
    });
    assert.equal(context.logs[0][0], "Error starting recording:");
    assert.deepEqual(context.updates, []);
});

test("voice hook reports a missing transcription key and resets processing", async () => {
    const context = await loadHook({ apiKey: "" });
    await assert.rejects(context.hook.transcribeAudio(new Blob(["sound"])), {
        message: "OpenAI API key not found. Please add VITE_OPENAI_API_KEY to your .env file.",
    });
    assert.equal(context.calls.some(([event]) => event === "fetch"), false);
    assert.equal(context.logs[0][0], "Error transcribing audio:");
    assert.deepEqual(context.updates, [[1, true], [1, false]]);
});

test("voice hook relays transcription API errors and resets processing", async () => {
    const context = await loadHook({
        transcriptionResponse: {
            ok: false,
            status: 429,
            json: async () => ({ error: { message: "Rate limited" } }),
        },
    });
    await assert.rejects(context.hook.transcribeAudio(new Blob(["sound"])), {
        message: "Rate limited",
    });
    assert.equal(context.logs[0][0], "Error transcribing audio:");
    assert.deepEqual(context.updates, [[1, true], [1, false]]);
});
