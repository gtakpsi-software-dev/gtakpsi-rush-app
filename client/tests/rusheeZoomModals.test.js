import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatRatingValue } from "../src/features/comments/ratingDisplay.js";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../src/features/rushee/zoom/ZoomModals.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("./fixtures/rusheeZoomModals.json", import.meta.url));
const comment = { brother_name: "Ada Example", comment: "Helpful & clear", ratings: [{ name: "Why AKPsi", value: 4.5 }] };
const pis = { question: "Why join?", answer: "To learn & grow." };

function props(overrides = {}) {
    return { selectedComment: null, selectedPis: null, onCloseComment() {}, onClosePis() {}, ...overrides };
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

test("comment and PIS overlays retain their original rendered markup", async () => {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const ZoomModals = await loadTsxComponent(componentPath, {
        "../../comments/ratingDisplay": { formatRatingValue },
    });
    const scenarios = {
        comment: { selectedComment: comment },
        pis: { selectedPis: pis },
        both: { selectedComment: comment, selectedPis: pis },
    };
    for (const [name, values] of Object.entries(scenarios)) {
        const html = renderToStaticMarkup(React.createElement(ZoomModals, props(values)));
        const hash = createHash("sha256").update(html).digest("hex");
        assert.equal(hash, expected[name], `${name} overlay markup changed`);
    }
});

test("both overlays retain backdrop, close, and propagation handlers", async () => {
    const ZoomModals = await loadTsxComponent(componentPath, {
        "../../comments/ratingDisplay": { formatRatingValue },
    });
    const calls = [];
    const elements = collect(ZoomModals(props({
        selectedComment: comment,
        selectedPis: pis,
        onCloseComment: () => calls.push("comment"),
        onClosePis: () => calls.push("pis"),
    })));
    const backdrops = elements.filter((element) => element.props.className === "fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50");
    const innerCards = elements.filter((element) => element.props.className?.startsWith("card-apple p-6 w-11/12"));
    const closeButtons = elements.filter((element) => element.type === "button");
    assert.equal(backdrops.length, 2);
    assert.equal(innerCards.length, 2);
    assert.equal(closeButtons.length, 2);

    backdrops.forEach((element) => element.props.onClick());
    innerCards.forEach((element) => element.props.onClick({ stopPropagation: () => calls.push("stop") }));
    closeButtons.forEach((element) => element.props.onClick());
    assert.deepEqual(calls, ["comment", "pis", "stop", "stop", "comment", "pis"]);
});
