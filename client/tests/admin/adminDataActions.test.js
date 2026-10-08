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

// Walk the rendered element tree to collect nodes for assertions.
function collectButtons(node, buttons = []) {
    if (Array.isArray(node)) node.forEach(/* Invoke collectButtons with the test inputs. */ (child) => collectButtons(child, buttons));
    else if (React.isValidElement(node)) {
        if (node.type === "button") buttons.push(node);
        collectButtons(node.props.children, buttons);
    }
    return buttons;
}

test("admin data actions retain original markup and order", async () => {
    // Verify admin data actions retain original markup and order.
    const { default: expected } = JSON.parse(await readFile(fixturePath, "utf8"));
    const AdminDataActions = await loadTsxComponent(componentPath);
    const html = renderToStaticMarkup(React.createElement(AdminDataActions, {
        // Provide an inert export rushee numbers stub for this test.
        exportRusheeNumbers() {},
        // Provide an inert export pisschedule stub for this test.
        exportPISSchedule() {},
        // Provide an inert export rushee personal info stub for this test.
        exportRusheePersonalInfo() {},
        // Provide an inert handle request stub for this test.
        handleRequest() {},
    }));

    assert.equal(createHash("sha256").update(html).digest("hex"), expected);
});

test("export and fetch buttons retain their original handlers and requests", async () => {
    // Verify export and fetch buttons retain their original handlers and requests.
    const AdminDataActions = await loadTsxComponent(componentPath);
    const calls = [];
    const buttons = collectButtons(AdminDataActions({
        // Record export rushee numbers calls for assertions.
        exportRusheeNumbers: () => calls.push(["numbers"]),
        // Record export pisschedule calls for assertions.
        exportPISSchedule: () => calls.push(["schedule"]),
        // Record export rushee personal info calls for assertions.
        exportRusheePersonalInfo: () => calls.push(["personalInfo"]),
        // Record handle request calls for assertions.
        handleRequest: (...args) => calls.push(["request", ...args]),
    }));

    assert.equal(buttons.length, 5);
    buttons.forEach(/* Invoke button.props.onClick with the test inputs. */ (button) => button.props.onClick());
    assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
        ["numbers"],
        ["schedule"],
        ["personalInfo"],
        ["request", "get_pis_questions", {}, "get", "Check console for questions"],
        ["request", "get_pis_timeslots", {}, "get", "Check console for timeslots"],
    ]);
});
