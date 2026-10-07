import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const fixturePath = fileURLToPath(new URL("../fixtures/adminDataActions.json", import.meta.url));
const componentPath = fileURLToPath(new URL("../../src/features/admin/data/AdminDataActions.tsx", import.meta.url));

function collectButtons(node, buttons = []) {
    if (Array.isArray(node)) node.forEach((child) => collectButtons(child, buttons));
    else if (React.isValidElement(node)) {
        if (node.type === "button") buttons.push(node);
        collectButtons(node.props.children, buttons);
    }
    return buttons;
}

test("admin data actions retain original markup and order", async () => {
    const { default: expected } = JSON.parse(await readFile(fixturePath, "utf8"));
    const AdminDataActions = await loadTsxComponent(componentPath);
    const html = renderToStaticMarkup(React.createElement(AdminDataActions, {
        exportRusheeNumbers() {},
        exportPISSchedule() {},
        exportRusheePersonalInfo() {},
        handleRequest() {},
    }));

    assert.equal(createHash("sha256").update(html).digest("hex"), expected);
});

test("export and fetch buttons retain their original handlers and requests", async () => {
    const AdminDataActions = await loadTsxComponent(componentPath);
    const calls = [];
    const buttons = collectButtons(AdminDataActions({
        exportRusheeNumbers: () => calls.push(["numbers"]),
        exportPISSchedule: () => calls.push(["schedule"]),
        exportRusheePersonalInfo: () => calls.push(["personalInfo"]),
        handleRequest: (...args) => calls.push(["request", ...args]),
    }));

    assert.equal(buttons.length, 5);
    buttons.forEach((button) => button.props.onClick());
    assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
        ["numbers"],
        ["schedule"],
        ["personalInfo"],
        ["request", "get_pis_questions", {}, "get", "Check console for questions"],
        ["request", "get_pis_timeslots", {}, "get", "Check console for timeslots"],
    ]);
});
