import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const pagePath = fileURLToPath(new URL("../../src/pages/Login.tsx", import.meta.url));
const viewPath = fileURLToPath(new URL("../../src/features/auth/LoginView.tsx", import.meta.url));
const emailFieldPath = fileURLToPath(new URL("../../src/features/auth/AuthEmailField.tsx", import.meta.url));

// Load page with injected dependencies for isolated tests.
async function loadPage({ loading = false, loginSuccess = true, verify = /* Return false from this dependency stub. */ async () => false } = {}) {
    const updates = [];
    const navigations = [];
    const loginRequests = [];
    const effects = [];
    let refIndex = 0;

    // Render a lightweight React element for component assertions.
    function LinkStub({ to, children }) {
        return React.createElement("a", { "data-to": to }, children);
    }
    LinkStub.propTypes = { to:
        /* Return null from this dependency stub. */
        () => null, children:
        /* Return null from this dependency stub. */
        () => null };
    // Render a lightweight React element for component assertions.
    function NavbarStub() {
        return React.createElement("span", { "data-stub": "navbar" });
    }
    // Render a lightweight React element for component assertions.
    function LoaderStub() {
        return React.createElement("span", { "data-stub": "loader" });
    }
    const EmailField = await loadTsxComponent(emailFieldPath);
    const View = await loadTsxComponent(viewPath, {
        "react-router-dom": { Link: LinkStub },
        "../../components/Loader": LoaderStub,
        "../../components/Navbar": NavbarStub,
        "./AuthEmailField": EmailField,
    });

    const Page = await loadTsxComponent(pagePath, {
        react: {
            ...React,
            // Supply controlled state and a setter without mounting React.
            useState: (initial) => [loading ?? initial, /* Record callback arguments for assertions. */ (value) => updates.push(value)],
            // Capture effects so the test can run them explicitly.
            useEffect: (effect) => effects.push(effect),
            // Provide a mutable ref without mounting a React component.
            useRef: () => ({ current: { value: refIndex++ === 0 ? "ada@example.edu" : "secret" } }),
        },
        "react-router-dom": {
            Link: LinkStub,
            // Provide the callback used by this dependency stub.
            useNavigate: () => /* Record callback arguments for assertions. */ (path) => navigations.push(path),
        },
        "../features/auth/verifyUser": { verifyUser: verify },
        "../components/Loader": LoaderStub,
        "../components/Navbar": NavbarStub,
        "../features/auth/LoginView": View,
        "../features/auth/account": {
            // Record login credentials and return the configured login result.
            login: async (credentials) => {
                loginRequests.push(credentials);
                return loginSuccess;
            },
        },
    });
    return { Page, updates, navigations, loginRequests, effects };
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

test("login retains loading and form markup", async () => {
    // Verify login retains loading and form markup.
    const actual = {};
    for (const [name, loading] of [["loading", true], ["form", false]]) {
        const { Page } = await loadPage({ loading });
        const html = renderToStaticMarkup(React.createElement(Page));
        actual[name] = createHash("sha256").update(html).digest("hex");
    }
    assert.deepEqual(actual, {
        loading: "ba9e77d7a57b6d66d82c3038680760fccfbef7648a8aa4c8b5564a159c940425",
        form: "4ef47fc35df546e92eb2cc5641fd96679af30f172827eaabc0925ae361d85cbd",
    });
});

test("login retains credentials, routes, and Enter submission", async () => {
    // Verify login retains credentials, routes, and Enter submission.
    const success = await loadPage();
    const elements = collect(success.Page());
    assert.deepEqual(elements.filter(
        /* Match element.props.to. */
        (element) => element.props.to).map(
        /* Extract the router link destination. */
        (element) => element.props.to), [
        "/forgot-password", "/create-account",
    ]);
    await elements.find(
        /* Find the button with label Sign In. */
        (element) => element.type === "button" && element.props.children === "Sign In")
        .props.onClick();
    assert.deepEqual(JSON.parse(JSON.stringify(success.loginRequests)), [
        { email: "ada@example.edu", pwd: "secret" },
    ]);
    assert.deepEqual(success.navigations, ["/dashboard"]);

    const failed = await loadPage({ loginSuccess: false });
    const input = collect(failed.Page()).find(/* Identify rendered input elements. */ (element) => element.type === "input");
    input.props.onKeyPress({ key: "Enter" });
    await setImmediate();
    assert.equal(failed.loginRequests.length, 1);
    assert.deepEqual(failed.navigations, []);
});

test("login retains verification redirects and loading transitions", async () => {
    // Verify login retains verification redirects and loading transitions.
    for (const [verify, navigations, updates] of [
        [/* Return true from this dependency stub. */ async () => true, ["/dashboard"], [true]],
        [/* Return false from this dependency stub. */ async () => false, [], [true, false]],
        [async () => {
            // Simulate a dependency failure for this scenario.
             throw Error("offline"); }, [], [true, false]],
    ]) {
        const page = await loadPage({ loading: true, verify });
        page.Page();
        page.effects[0]();
        await setImmediate();
        assert.deepEqual(page.navigations, navigations);
        assert.deepEqual(page.updates, updates);
    }
});

test("idle login does not reverify or submit for another key", async () => {
    // Verify idle login does not reverify or submit for another key.
    let verifications = 0;
    const page = await loadPage({
        loading: false,
        // Count verification calls and allow access.
        verify: async () => { verifications += 1; return true; },
    });
    const input = collect(page.Page()).find(/* Identify rendered input elements. */ (element) => element.type === "input");
    page.effects[0]();
    input.props.onKeyPress({ key: "Tab" });
    await setImmediate();

    assert.equal(verifications, 0);
    assert.deepEqual(page.loginRequests, []);
    assert.deepEqual(page.navigations, []);
    assert.deepEqual(page.updates, []);
});
