import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const pagePath = fileURLToPath(new URL("../../src/pages/ForgotPassword.tsx", import.meta.url));
const viewPath = fileURLToPath(new URL("../../src/features/auth/ForgotPasswordView.tsx", import.meta.url));
const emailFieldPath = fileURLToPath(new URL("../../src/features/auth/AuthEmailField.tsx", import.meta.url));

// Load page with injected dependencies for isolated tests.
async function loadPage({ state = {}, email = "sam@example.edu", success = true } = {}) {
    const updates = [];
    const requests = [];
    let stateIndex = 0;
    // Render a lightweight React element for component assertions.
    function LinkStub() {
        return React.createElement("a", { "data-stub": "link" });
    }
    // Render a lightweight React element for component assertions.
    function NavbarStub() {
        return React.createElement("span", { "data-stub": "navbar" });
    }
    const EmailField = await loadTsxComponent(emailFieldPath);
    const View = await loadTsxComponent(viewPath, {
        "react-router-dom": { Link: LinkStub },
        "../../components/Navbar": NavbarStub,
        "./AuthEmailField": EmailField,
    });
    const Page = await loadTsxComponent(pagePath, {
        react: {
            ...React,
            // Supply controlled state and a setter without mounting React.
            useState(initial) {
                const index = stateIndex++;
                return [Object.hasOwn(state, index) ? state[index] : initial,
                    /* Record callback arguments for assertions. */ (value) => updates.push([index, value])];
            },
            // Provide a mutable ref without mounting a React component.
            useRef: () => ({ current: { value: email } }),
        },
        "react-router-dom": { Link: LinkStub },
        "../features/auth/account": {
            // Record the reset request and return its configured success state.
            resetPassword: async (value) => {
                requests.push(value);
                return success;
            },
        },
        "../features/auth/ForgotPasswordView": View,
        "../components/Navbar": NavbarStub,
    });
    return { Page, updates, requests };
}

// Walk the rendered element tree to collect nodes for assertions.
function collect(node, elements = []) {
    if (!React.isValidElement(node)) return elements;
    elements.push(node);
    if (typeof node.type === "function") {
        collect(node.type(node.props), elements);
    } else {
        React.Children.forEach(node.props.children, /* Invoke collect with the test inputs. */ (child) => collect(child, elements));
    }
    return elements;
}

test("password reset retains form, sending, and sent markup", async () => {
    // Verify password reset retains form, sending, and sent markup.
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
    // Verify reset button retains the email request and state-update order.
    const { Page, updates, requests } = await loadPage();
    const button = collect(Page()).find(/* Identify rendered button elements. */ (node) => node.type === "button");
    await button.props.onClick();

    assert.deepEqual(requests, ["sam@example.edu"]);
    assert.deepEqual(updates, [[0, true], [0, false], [1, true]]);
});

test("failed reset clears sending without showing the sent state", async () => {
    // Verify failed reset clears sending without showing the sent state.
    const { Page, updates, requests } = await loadPage({ success: false });
    const button = collect(Page()).find(/* Identify rendered button elements. */ (node) => node.type === "button");
    await button.props.onClick();

    assert.deepEqual(requests, ["sam@example.edu"]);
    assert.deepEqual(updates, [[0, true], [0, false]]);
});

test("empty email skips reset and Enter submits a filled email", async () => {
    // Verify empty email skips reset and Enter submits a filled email.
    const empty = await loadPage({ email: "" });
    const emptyButton = collect(empty.Page()).find(/* Identify rendered button elements. */ (node) => node.type === "button");
    await emptyButton.props.onClick();
    assert.deepEqual(empty.requests, []);
    assert.deepEqual(empty.updates, []);

    const filled = await loadPage();
    const input = collect(filled.Page()).find(/* Identify rendered input elements. */ (node) => node.type === "input");
    input.props.onKeyPress({ key: "Enter" });
    await setImmediate();
    assert.deepEqual(filled.requests, ["sam@example.edu"]);
});

test("sent state retains Try Again and sign-in route", async () => {
    // Verify sent state retains Try Again and sign-in route.
    const { Page, updates } = await loadPage({ state: { 1: true } });
    const elements = collect(Page());
    const button = elements.find(/* Identify rendered button elements. */ (node) => node.type === "button");
    const link = elements.find(/* Match node.props.to to "/login". */ (node) => node.props.to === "/login");

    button.props.onClick();
    assert.deepEqual(updates, [[1, false]]);
    assert.ok(link);
});
