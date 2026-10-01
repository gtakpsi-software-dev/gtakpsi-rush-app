import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../src/components/VoiceTranscriptionHandler.tsx", import.meta.url));

function RecorderStub() {
    return React.createElement("span", { "data-stub": "recorder" });
}

async function loadHandler() {
    return loadTsxComponent(componentPath, { "./VoiceRecorder": RecorderStub });
}

test("voice transcription handler retains enabled and disabled markup", async () => {
    const Handler = await loadHandler();
    const hashes = [false, true].map((disabled) => {
        const html = renderToStaticMarkup(React.createElement(Handler, {
            onTranscription() {}, disabled,
        }));
        return createHash("sha256").update(html).digest("hex");
    });
    assert.deepEqual(hashes, [
        "baed743578119654be82fcd747dbfe3e1a4803e6c6948241bffc873ed39a5cde",
        "59d989ec6089454efe0ad98387d5c19d8bdd405a7e350d7a7f937372d67df78a",
    ]);
});

test("voice transcription trims and appends with the original spacing", async () => {
    const Handler = await loadHandler();
    const results = [];
    const first = Handler({
        onTranscription: (value) => results.push(value),
        questionKey: "legacy-key",
        currentValue: "Existing answer",
    });
    const recorder = first.props.children[0];
    recorder.props.onTranscription("  more detail  ");
    recorder.props.onTranscription("  ");

    const trailing = Handler({
        onTranscription: (value) => results.push(value), currentValue: "Existing answer ",
    });
    trailing.props.children[0].props.onTranscription("more");
    const empty = Handler({ onTranscription: (value) => results.push(value) });
    empty.props.children[0].props.onTranscription("  first answer  ");

    assert.deepEqual(results, ["Existing answer more detail", "Existing answer more", "first answer"]);
});

test("disabled flag still reaches the recorder", async () => {
    const Handler = await loadHandler();
    const tree = Handler({ onTranscription() {}, disabled: true });
    assert.equal(tree.props.children[0].props.disabled, true);
});
