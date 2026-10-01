import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const pagePath = fileURLToPath(new URL("../src/pages/ForgotPassword.tsx", import.meta.url));

async function loadPage({ state = {}, email = "sam@example.edu", success = true } = {}) {
    const updates = [];
    const requests = [];
    let stateIndex = 0;
    function LinkStub() {
        return React.createElement("a", { "data-stub": "link" });
    }
    const Page = await loadTsxComponent(pagePath, {
        react: {
            ...React,
            useState(initial) {
                const index = stateIndex++;
                return [Object.hasOwn(state, index) ? state[index] : initial,
                    (value) => updates.push([index, value])];
            },
            useRef: () => ({ current: { value: email } }),
        },
        "react-router-dom": { Link: LinkStub },
        "../features/auth/account": {
            resetPassword: async (value) => {
                requests.push(value);
                return success;
            },
        },
        "../components/Navbar": () => React.createElement("span", { "data-stub": "navbar" }),
    });
    return { Page, updates, requests };
}

function collect(node, elements = []) {
    if (!React.isValidElement(node)) return elements;
    elements.push(node);
    React.Children.forEach(node.props.children, (child) => collect(child, elements));
    return elements;
}

test("password reset retains form, sending, and sent markup", async () => {
    const actual = {};
    for (const [name, state] of Object.entries({
        form: {}, loading: { 0: true }, sent: { 1: true },
    })) {
        const { Page } = await loadPage({ state });
        const html = renderToStaticMarkup(React.createElement(Page));
        actual[name] = createHash("sha256").update(html).digest("hex");
    }

    assert.deepEqual(actual, {
        form: "982aa1f53ad881d3427d2cc71b84c51075577918f45c13e13f7022ed972131fd",
        loading: "89a388a7fdc07cf10ea87660995e7d44246c2f6c100540f00bf94a29e9d11860",
        sent: "bdd30496b6e64576cd2b7db43320a0df5232f366d7cfc29996441cdca74b4dec",
    });
});

test("reset button retains the email request and state-update order", async () => {
    const { Page, updates, requests } = await loadPage();
    const button = collect(Page()).find((node) => node.type === "button");
    await button.props.onClick();

    assert.deepEqual(requests, ["sam@example.edu"]);
    assert.deepEqual(updates, [[0, true], [0, false], [1, true]]);
});

test("empty email skips reset and Enter submits a filled email", async () => {
    const empty = await loadPage({ email: "" });
    const emptyButton = collect(empty.Page()).find((node) => node.type === "button");
    await emptyButton.props.onClick();
    assert.deepEqual(empty.requests, []);
    assert.deepEqual(empty.updates, []);

    const filled = await loadPage();
    const input = collect(filled.Page()).find((node) => node.type === "input");
    input.props.onKeyPress({ key: "Enter" });
    await setImmediate();
    assert.deepEqual(filled.requests, ["sam@example.edu"]);
});

test("sent state retains Try Again and sign-in route", async () => {
    const { Page, updates } = await loadPage({ state: { 1: true } });
    const elements = collect(Page());
    const button = elements.find((node) => node.type === "button");
    const link = elements.find((node) => node.props.to === "/login");

    button.props.onClick();
    assert.deepEqual(updates, [[1, false]]);
    assert.ok(link);
});
