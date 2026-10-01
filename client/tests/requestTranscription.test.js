import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import { requestTranscription } from "../src/features/voice/requestTranscription.js";

function fakeWeb(response) {
    const requests = [];
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
    return {
        requests,
        File: FileStub,
        FormData: FormDataStub,
        async fetch(url, options) {
            requests.push({ url, options });
            return response;
        },
    };
}

test("transcription request preserves the WebM bytes and API contract", async () => {
    const web = fakeWeb({ ok: true, json: async () => ({ text: "spoken answer" }) });
    const result = await requestTranscription(new Blob(["sound"]), "test-key", web);

    assert.equal(result, "spoken answer");
    assert.equal(web.requests.length, 1);
    const { url, options } = web.requests[0];
    assert.equal(url, "https://api.openai.com/v1/audio/transcriptions");
    assert.equal(options.method, "POST");
    assert.deepEqual(options.headers, { Authorization: "Bearer test-key" });
    assert.deepEqual(options.body.fields.map(([name]) => name), ["file", "model", "language"]);
    const file = options.body.fields[0][1];
    assert.equal(file.name, "recording.webm");
    assert.equal(file.type, "audio/webm;codecs=opus");
    assert.equal(Buffer.from(file.parts[0]).toString(), "sound");
    assert.equal(options.body.fields[1][1], "whisper-1");
    assert.equal(options.body.fields[2][1], "en");
});

test("missing transcription key fails before reading audio or sending a request", async () => {
    const web = fakeWeb({ ok: true, json: async () => ({ text: "unused" }) });
    const blob = { arrayBuffer: () => { throw Error("audio was read"); } };
    await assert.rejects(requestTranscription(blob, "", web), {
        message: "OpenAI API key not found. Please add VITE_OPENAI_API_KEY to your .env file.",
    });
    assert.equal(web.requests.length, 0);
});

test("transcription API error keeps its response message", async () => {
    const web = fakeWeb({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: "Rate limited" } }),
    });
    await assert.rejects(requestTranscription(new Blob(["sound"]), "test-key", web), {
        message: "Rate limited",
    });
});

test("unparseable API error falls back to the HTTP status", async () => {
    const web = fakeWeb({
        ok: false,
        status: 502,
        json: async () => { throw Error("invalid JSON"); },
    });
    await assert.rejects(requestTranscription(new Blob(["sound"]), "test-key", web), {
        message: "HTTP error! status: 502",
    });
});

test("missing transcription text returns an empty string", async () => {
    const web = fakeWeb({ ok: true, json: async () => ({}) });
    assert.equal(await requestTranscription(new Blob(["sound"]), "test-key", web), "");
});
