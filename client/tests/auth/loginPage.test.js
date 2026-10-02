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

async function loadPage({ loading = false, loginSuccess = true, verify = async () => false } = {}) {
    const updates = [];
    const navigations = [];
    const loginRequests = [];
    const effects = [];
    let refIndex = 0;

    function LinkStub({ to, children }) {
        return React.createElement("a", { "data-to": to }, children);
    }
    LinkStub.propTypes = { to: () => null, children: () => null };
    function NavbarStub() {
        return React.createElement("span", { "data-stub": "navbar" });
    }
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
            useState: (initial) => [loading ?? initial, (value) => updates.push(value)],
            useEffect: (effect) => effects.push(effect),
            useRef: () => ({ current: { value: refIndex++ === 0 ? "ada@example.edu" : "secret" } }),
        },
        "react-router-dom": {
            Link: LinkStub,
            useNavigate: () => (path) => navigations.push(path),
        },
        "../features/auth/verifyUser": { verifyUser: verify },
        "../components/Loader": LoaderStub,
        "../components/Navbar": NavbarStub,
        "../features/auth/LoginView": View,
        "../features/auth/account": {
            login: async (credentials) => {
                loginRequests.push(credentials);
                return loginSuccess;
            },
        },
    });
    return { Page, updates, navigations, loginRequests, effects };
}

function collect(node, elements = []) {
    if (!React.isValidElement(node)) return elements;
    elements.push(node);
    if (typeof node.type === "function") {
        collect(node.type(node.props), elements);
    } else {
        React.Children.forEach(node.props.children, (child) => collect(child, elements));
    }
    return elements;
}

test("login retains loading and form markup", async () => {
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
    const success = await loadPage();
    const elements = collect(success.Page());
    assert.deepEqual(elements.filter((element) => element.props.to).map((element) => element.props.to), [
        "/forgot-password", "/create-account",
    ]);
    await elements.find((element) => element.type === "button" && element.props.children === "Sign In")
        .props.onClick();
    assert.deepEqual(JSON.parse(JSON.stringify(success.loginRequests)), [
        { email: "ada@example.edu", pwd: "secret" },
    ]);
    assert.deepEqual(success.navigations, ["/dashboard"]);

    const failed = await loadPage({ loginSuccess: false });
    const input = collect(failed.Page()).find((element) => element.type === "input");
    input.props.onKeyPress({ key: "Enter" });
    await setImmediate();
    assert.equal(failed.loginRequests.length, 1);
    assert.deepEqual(failed.navigations, []);
});

test("login retains verification redirects and loading transitions", async () => {
    for (const [verify, navigations, updates] of [
        [async () => true, ["/dashboard"], [true]],
        [async () => false, [], [true, false]],
        [async () => { throw Error("offline"); }, [], [true, false]],
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
    let verifications = 0;
    const page = await loadPage({
        loading: false,
        verify: async () => { verifications += 1; return true; },
    });
    const input = collect(page.Page()).find((element) => element.type === "input");
    page.effects[0]();
    input.props.onKeyPress({ key: "Tab" });
    await setImmediate();

    assert.equal(verifications, 0);
    assert.deepEqual(page.loginRequests, []);
    assert.deepEqual(page.navigations, []);
    assert.deepEqual(page.updates, []);
});
