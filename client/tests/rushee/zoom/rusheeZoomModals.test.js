import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatRatingValue } from "../../../src/features/comments/ratingDisplay.js";
import { loadTsxComponent } from "../../helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../../../src/features/rushee/zoom/ZoomModals.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("../../fixtures/rusheeZoomModals.json", import.meta.url));
const comment = { brother_name: "Ada Example", comment: "Helpful & clear", ratings: [{ name: "Why AKPsi", value: 4.5 }] };
const pis = { question: "Why join?", answer: "To learn & grow." };

// Build component props with test-specific overrides.
function props(overrides = {}) {
    return { selectedComment: null, selectedPis: null,
        /* Provide an inert on close comment stub for this test. */
        onCloseComment() {},
        /* Provide an inert on close pis stub for this test. */
        onClosePis() {}, ...overrides };
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

test("comment and PIS overlays retain their original rendered markup", async () => {
    // Verify comment and PIS overlays retain their original rendered markup.
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
    // Verify both overlays retain backdrop, close, and propagation handlers.
    const ZoomModals = await loadTsxComponent(componentPath, {
        "../../comments/ratingDisplay": { formatRatingValue },
    });
    const calls = [];
    const elements = collect(ZoomModals(props({
        selectedComment: comment,
        selectedPis: pis,
        // Record on close comment calls for assertions.
        onCloseComment: () => calls.push("comment"),
        // Record on close pis calls for assertions.
        onClosePis: () => calls.push("pis"),
    })));
    const backdrops = elements.filter(
        /* Identify elements with the expected styling classes. */
        (element) => element.props.className === "fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50");
    const innerCards = elements.filter(
        /* Identify elements with the expected styling classes. */
        (element) => element.props.className?.startsWith("card-apple p-6 w-11/12"));
    const closeButtons = elements.filter(/* Identify rendered button elements. */ (element) => element.type === "button");
    assert.equal(backdrops.length, 2);
    assert.equal(innerCards.length, 2);
    assert.equal(closeButtons.length, 2);

    backdrops.forEach(/* Invoke element.props.onClick with the test inputs. */ (element) => element.props.onClick());
    innerCards.forEach(
        /* Invoke element.props.onClick with the test inputs. */
        (element) => element.props.onClick({ stopPropagation:
        /* Record stop propagation calls for assertions. */
        () => calls.push("stop") }));
    closeButtons.forEach(/* Invoke element.props.onClick with the test inputs. */ (element) => element.props.onClick());
    assert.deepEqual(calls, ["comment", "pis", "stop", "stop", "comment", "pis"]);
});
