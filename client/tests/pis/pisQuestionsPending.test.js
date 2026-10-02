import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../../src/features/pis/PisQuestionsPending.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("../fixtures/pisQuestionsPending.json", import.meta.url));
const Navbar = () => React.createElement("nav", { "data-stub": "navbar" });

test("pending PIS screen retains unlock and fixed-question states", async () => {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const PisQuestionsPending = await loadTsxComponent(componentPath, {
        "../../components/Navbar": Navbar,
    });
    const timeCalls = [];
    const revealAt = {
        toLocaleTimeString(...args) {
            timeCalls.push(args);
            return "10:30 AM";
        },
    };
    const scenarios = {
        waiting: { revealAt: null, questions: [] },
        fixed: { revealAt, questions: [{ question: "Fixed one" }, { question: "Fixed two" }] },
        noFixed: { revealAt, questions: [] },
    };
    for (const [name, props] of Object.entries(scenarios)) {
        const html = renderToStaticMarkup(React.createElement(PisQuestionsPending, props));
        assert.equal(createHash("sha256").update(html).digest("hex"), expected[name]);
    }
    assert.deepEqual(timeCalls.map(([locales, options]) => ({
        localesLength: locales.length,
        hour: options.hour,
        minute: options.minute,
    })), [
        { localesLength: 0, hour: "numeric", minute: "2-digit" },
        { localesLength: 0, hour: "numeric", minute: "2-digit" },
    ]);
});
