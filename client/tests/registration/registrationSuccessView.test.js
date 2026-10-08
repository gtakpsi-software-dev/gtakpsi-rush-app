import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformWithEsbuild } from "vite";

const componentPath = fileURLToPath(new URL("../../src/features/registration/RegistrationSuccessView.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("../fixtures/registrationSuccessMarkup.json", import.meta.url));

// Load component with injected dependencies for isolated tests.
async function loadComponent({ copied = false, navigator = {}, setCopied =
    /* Leave this mocked callback inert. */
    () => {}, setTimeout =
    /* Leave this mocked callback inert. */
    () => {} } = {}) {
    const source = await readFile(componentPath, "utf8");
    const { code } = await transformWithEsbuild(source, componentPath, {
        loader: "tsx", format: "cjs", jsx: "automatic",
    });
    const module = { exports: {} };
    const requireFromComponent = createRequire(componentPath);

    runInNewContext(code, {
        module,
        exports: module.exports,
        navigator,
        setTimeout,
        window: { location: { origin: "https://rush.example.edu" } },
        // Resolve injected test dependencies before falling back to real modules.
        require(specifier) {
            if (specifier === "react") {
                return { ...React, useState: /* Supply controlled state and a setter without mounting React. */ () => [copied, setCopied] };
            }
            return requireFromComponent(specifier);
        },
    }, { filename: componentPath });

    return module.exports.default;
}

// Find the first button in the rendered element tree.
function findButton(node) {
    if (Array.isArray(node)) return node.map(findButton).find(Boolean);
    if (!React.isValidElement(node)) return null;
    if (node.type === "button") return node;
    return findButton(node.props.children);
}

const props = {
    title: "Registration complete",
    description: "Use your personal link",
    accessCode: "access-code",
    gtid: "12345",
};

test("registration success retains the personal link and copy-state markup", async () => {
    // Verify registration success retains the personal link and copy-state markup.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const actual = {};

    for (const [name, copied] of [["ready", false], ["copied", true]]) {
        const RegistrationSuccessView = await loadComponent({ copied });
        const html = renderToStaticMarkup(React.createElement(RegistrationSuccessView, props));
        actual[name] = createHash("sha256").update(html).digest("hex");
        assert.match(html, /https:\/\/rush\.example\.edu\/rushee\/12345\/access-code/);
    }

    assert.deepEqual(actual, expected);
});

test("copy button writes the same link and resets its state after two seconds", async () => {
    // Verify copy button writes the same link and resets its state after two seconds.
    const calls = [];
    let reset;
    const RegistrationSuccessView = await loadComponent({
        navigator: {
            clipboard: {
                // Record copied text and resolve the clipboard request.
                writeText: (value) => {
                    calls.push(["writeText", value]);
                    return Promise.resolve();
                },
            },
        },
        // Record set copied calls for assertions.
        setCopied: (value) => calls.push(["setCopied", value]),
        // Capture the copy-status reset callback and its delay.
        setTimeout: (callback, delay) => {
            calls.push(["setTimeout", delay]);
            reset = callback;
        },
    });

    findButton(RegistrationSuccessView(props)).props.onClick();
    await Promise.resolve();
    assert.deepEqual(calls, [
        ["writeText", "https://rush.example.edu/rushee/12345/access-code"],
        ["setCopied", true],
        ["setTimeout", 2000],
    ]);

    reset();
    assert.deepEqual(calls.at(-1), ["setCopied", false]);
});
