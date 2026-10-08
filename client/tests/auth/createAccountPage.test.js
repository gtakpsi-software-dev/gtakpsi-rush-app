import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const pagePath = fileURLToPath(new URL("../../src/pages/CreateAccount.jsx", import.meta.url));
const viewPath = fileURLToPath(new URL("../../src/features/auth/CreateAccountView.tsx", import.meta.url));
const emailFieldPath = fileURLToPath(new URL("../../src/features/auth/AuthEmailField.tsx", import.meta.url));

// Load page with injected dependencies for isolated tests.
async function loadPage(loading) {
    const refs = [];
    const actions = [];
    // Provide an inert navigate stub for this test.
    const navigate = () => {};
    const toast = {};
    // Provide an inert set loading stub for this test.
    const setLoading = () => {};
    // Provide an inert create account stub for this test.
    const createAccount = () => {};
    // Provide an inert handle create account stub for this test.
    const handleCreateAccount = () => {};
    // Provide an inert handle key press stub for this test.
    const handleKeyPress = () => {};

    // Render a lightweight React element for component assertions.
    function Link({ to, children }) {
        return React.createElement("a", { "data-to": to }, children);
    }
    Link.propTypes = { to:
        /* Return no value from this dependency stub. */
        () => null, children:
        /* Return no value from this dependency stub. */
        () => null };
    // Render a lightweight React element for component assertions.
    function Navbar() {
        return React.createElement("span", { "data-stub": "navbar" });
    }
    const EmailField = await loadTsxComponent(emailFieldPath);
    const View = await loadTsxComponent(viewPath, {
        "react-router-dom": { Link },
        "../../components/Navbar": Navbar,
        "./AuthEmailField": EmailField,
    });

    const dependencies = {
        react: {
            ...React,
            // Expose controlled hook state and capture updates for assertions.
            useState: () => [loading, setLoading],
            // Provide a mutable ref without mounting a React component.
            useRef: () => {
                const ref = { current: { value: `field-${refs.length}` } };
                refs.push(ref);
                return ref;
            },
        },
        "react-router-dom": { Link, useNavigate: /* Return navigate to the caller. */ () => navigate },
        "react-toastify": { toast },
        "../features/auth/account": { createAccount },
        "../features/auth/createAccountFormActions": {
            // Capture form dependencies and return controlled account handlers.
            createAccountFormActions: (options) => {
                actions.push(options);
                return { handleCreateAccount, handleKeyPress };
            },
        },
        "../components/Navbar": Navbar,
        "../features/auth/CreateAccountView": View,
    };
    const Page = await loadTsxComponent(pagePath, dependencies);

    return {
        Page, dependencies, refs, actions, navigate, toast, setLoading,
        createAccount, handleCreateAccount, handleKeyPress,
    };
}

test("account creation retains idle and loading markup", async () => {
    // Verify account creation retains idle and loading markup.
    const hashes = [];
    for (const loading of [false, true]) {
        const { Page } = await loadPage(loading);
        const html = renderToStaticMarkup(React.createElement(Page));
        hashes.push(createHash("sha256").update(html).digest("hex"));
    }
    assert.deepEqual(hashes, [
        "27222291220d20f6d6e17084c1fd0c971d13028136484a580f5d1f2b7fb902c1",
        "4f198017776dc555d64807ef8b0752a86e0d95b45ed2377ef72a8993a621df34",
    ]);
});

test("account creation keeps field refs and actions in form order", async () => {
    // Verify account creation keeps field refs and actions in form order.
    const page = await loadPage(false);
    renderToStaticMarkup(React.createElement(page.Page));

    assert.equal(page.refs.length, 5);
    const options = page.actions[0];
    assert.deepEqual([
        options.firstName, options.lastName, options.email,
        options.password, options.confirmPassword,
    ], page.refs);
    assert.equal(options.toast, page.toast);
    assert.equal(options.setLoading, page.setLoading);
    assert.equal(options.createAccount, page.createAccount);
    assert.equal(options.navigate, page.navigate);
});
