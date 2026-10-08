import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { createEmptyColumns } from "../../../src/features/sorting/board.js";
import { loadPage } from "../../helpers/loadViewerSortingPage.js";

const fixturePath = fileURLToPath(new URL("../../fixtures/viewerSortingPageMarkup.json", import.meta.url));

test("brother and bid-committee viewer pages retain their loading and board markup", async () => {
    // Verify brother and bid-committee viewer pages retain their loading and board markup.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const scenarios = {
        BrotherSorting: { loading: {}, ready: { 0: false }, details: { 0: false, 2: { id: "r1" } } },
        BidCommitteeSorting: { loading: {}, ready: { 0: false }, details: { 0: false, 3: { id: "r1" } } },
    };
    const actual = {};

    for (const [name, states] of Object.entries(scenarios)) {
        actual[name] = {};
        for (const [scenario, state] of Object.entries(states)) {
            const Page = await loadPage(name, state);
            const html = renderToStaticMarkup(React.createElement(Page));
            actual[name][scenario] = createHash("sha256").update(html).digest("hex");
        }
    }
    assert.deepEqual(actual, expected);
});

test("viewer pages pass the original board state and audience to their controls", async () => {
    // Verify viewer pages pass the original board state and audience to their controls.
    const columns = { ...createEmptyColumns(), UNSORTED: [{ id: "r1" }] };
    const selected = { id: "r1", rushNumber: 7 };
    const cases = [
        {
            name: "BrotherSorting",
            state: { 0: false, 1: columns, 2: selected, 6: 1.5, 8: true, 9: 3 },
            details: "read-only-details",
            showRusheeNames: true,
        },
        {
            name: "BidCommitteeSorting",
            state: { 0: false, 2: columns, 3: selected, 7: 1.5, 9: true, 10: 3 },
            details: "editable-notes",
            showRusheeNames: false,
        },
    ];

    for (const { name, state, details, showRusheeNames } of cases) {
        const captured = new Map();
        const Page = await loadPage(name, state, captured);
        renderToStaticMarkup(React.createElement(Page));

        assert.equal(captured.get("column").columns, columns);
        assert.equal(captured.get("column").showRusheeNames, showRusheeNames);
        assert.equal(captured.get("viewer-connection").showRusheeNames, showRusheeNames);
        assert.equal(captured.get("zoom").scale, 1.5);
        assert.equal(captured.get("presence").connected, true);
        assert.equal(captured.get("presence").viewerCount, 3);
        assert.equal(captured.get("board-root-ref"), captured.get("board-view").canvasRef);
        assert.equal(captured.get("wheel-listener").canvasRef, captured.get("board-view").canvasRef);
        assert.equal(captured.get("wheel-listener").loading, false);
        assert.equal(captured.get("board-root").onMouseDown, captured.get("board-view").onMouseDown);
        assert.equal(captured.get("board-root").onMouseMove, captured.get("board-view").onMouseMove);
        assert.equal(captured.get("board-root").onMouseUp, captured.get("board-view").onMouseUp);
        assert.equal(captured.get("board-root").onMouseLeave, captured.get("board-view").onMouseUp);
        assert.equal(captured.get("board-root").onContextMenu, captured.get("board-view").onContextMenu);
        assert.equal(captured.get(details).selectedRushee, selected);
        assert.equal(typeof captured.get(details).onViewRushee, "function");
    }
});

test("brother sorting wires its notes request and details callbacks", async () => {
    // Verify brother sorting wires its notes request and details callbacks.
    const captured = new Map();
    const Page = await loadPage("BrotherSorting", {
        0: false,
        2: { id: "r1" },
    }, captured);
    renderToStaticMarkup(React.createElement(Page));

    const options = captured.get("brother-details-options");
    const handlers = captured.get("brother-details-handlers");
    assert.equal(options.apiBase, "/api/brother");
    options.getNotes("/api/brother/rushees/r1/notes");
    assert.equal(captured.get("axios-get"), "/api/brother/rushees/r1/notes");
    assert.equal(captured.get("board-view").onOpen, handlers.openDetails);
    assert.equal(captured.get("read-only-details").onClose, handlers.closeDetails);
});

test("bid-committee sorting wires its auth subscription and socket setup", async () => {
    // Verify bid-committee sorting wires its auth subscription and socket setup.
    const captured = new Map();
    const Page = await loadPage("BidCommitteeSorting", { 1: false }, captured);
    renderToStaticMarkup(React.createElement(Page));

    const effects = captured.get("effects");
    assert.equal(effects.length, 1);
    assert.equal(effects[0].deps[1], false);
    effects[0].effect();
    const options = captured.get("auth-subscription");
    assert.equal(options.authChecked, false);
    assert.equal(typeof options.fetchData, "function");
    assert.equal(typeof options.navigate, "function");
    assert.ok(captured.has("viewer-connection"));
});

test("brother sorting retains its two-dependency auth listener", async () => {
    // Verify brother sorting retains its two-dependency auth listener.
    const captured = new Map();
    const Page = await loadPage("BrotherSorting", {}, captured);
    renderToStaticMarkup(React.createElement(Page));

    const effects = captured.get("effects");
    assert.equal(effects.length, 1);
    assert.equal(effects[0].deps.length, 2);
    effects[0].effect();
    const options = captured.get("auth-subscription");
    assert.equal(options.authChecked, false);
    assert.equal(typeof options.fetchData, "function");
    assert.equal(typeof options.navigate, "function");
});
