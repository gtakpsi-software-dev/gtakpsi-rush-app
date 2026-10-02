import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadRusheeZoomPage } from "./helpers/loadRusheeZoomPage.js";

const fixturePath = fileURLToPath(new URL("./fixtures/rusheeZoomPageMarkup.json", import.meta.url));
const rushee = {
    gtid: "123", access_code: "edit", comments: [{ brother_name: "Other Brother" }],
};

test("rushee zoom retains loading, admin, copied-link, and restricted markup", async () => {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const scenarios = {
        loading: {},
        admin: { 0: false, 8: rushee, 15: true },
        copied: { 0: false, 8: rushee, 15: true, 18: true },
        restricted: { 0: false, 8: rushee },
    };
    const actual = {};

    for (const [name, state] of Object.entries(scenarios)) {
        const Page = await loadRusheeZoomPage(state);
        const html = renderToStaticMarkup(React.createElement(Page));
        actual[name] = createHash("sha256").update(html).digest("hex");
    }
    assert.deepEqual(actual, expected);
});

test("comment view receives the original visibility and form/list props", async () => {
    const admin = new Map();
    const AdminPage = await loadRusheeZoomPage({ 0: false, 8: rushee, 15: true }, admin);
    renderToStaticMarkup(React.createElement(AdminPage));
    assert.equal(admin.get("comments-view").rusheeComments, rushee.comments);
    assert.equal(admin.get("comments-view").showAllComments, true);
    assert.equal(admin.get("comments-view").showVisibilityNotice, false);
    assert.equal(admin.get("new-comment").ratingFields.length, 4);
    assert.equal(typeof admin.get("new-comment").handleSubmitComment, "function");
    assert.equal(admin.get("existing-comments").visibleComments, rushee.comments);

    const restricted = new Map();
    const RestrictedPage = await loadRusheeZoomPage({ 0: false, 8: rushee }, restricted);
    renderToStaticMarkup(React.createElement(RestrictedPage));
    assert.equal(restricted.get("comments-view").showAllComments, false);
    assert.equal(restricted.get("comments-view").showVisibilityNotice, true);
    assert.deepEqual(restricted.get("existing-comments").visibleComments, []);
});

test("copy link writes the current rushee URL and resets copied state after two seconds", async () => {
    const captured = new Map();
    const calls = [];
    let reset;
    const Page = await loadRusheeZoomPage({ 0: false, 8: rushee }, captured, {
        onStateChange: (index, value) => calls.push([index, value]),
        globals: {
            window: { location: { origin: "https://rush.example" } },
            navigator: {
                clipboard: {
                    writeText: (value) => {
                        calls.push(["clipboard", value]);
                        return Promise.resolve();
                    },
                },
            },
            setTimeout: (callback, delay) => {
                calls.push(["timer", delay]);
                reset = callback;
            },
        },
    });
    renderToStaticMarkup(React.createElement(Page));

    captured.get("actions").onCopyLink();
    await Promise.resolve();
    assert.deepEqual(calls, [
        ["clipboard", "https://rush.example/rushee/123/edit"],
        [18, true],
        ["timer", 2000],
    ]);

    reset();
    assert.deepEqual(calls.at(-1), [18, false]);
});
