import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import React from "react";
import { transformWithEsbuild } from "vite";

const componentPath = fileURLToPath(new URL("../../src/features/voting/admin/QuestionDisplay.tsx", import.meta.url));

// Load question with injected dependencies for isolated tests.
async function loadQuestion({ question = "Current?", editing = true, inputValue = "New?" } = {}) {
    const updates = [];
    const requests = [];
    const source = (await readFile(componentPath, "utf8"))
        .replaceAll("import.meta.env.VITE_API_PREFIX", '"/api"');
    const { code } = await transformWithEsbuild(source, componentPath, {
        loader: "tsx", format: "cjs", jsx: "automatic",
    });
    const module = { exports: {} };
    const requireFromComponent = createRequire(componentPath);
    let stateIndex = 0;
    const states = [editing, inputValue];

    runInNewContext(code, {
        module,
        exports: module.exports,
        // Resolve injected test dependencies before falling back to real modules.
        require(specifier) {
            const dependencies = {
                react: {
                    ...React,
                    // Expose controlled hook state and capture updates for assertions.
                    useState(initial) {
                        const index = stateIndex++;
                        return [states[index] ?? initial, /* Record callback arguments for assertions. */ (value) => updates.push([index, value])];
                    },
                    // Provide a mutable ref without mounting a React component.
                    useRef: () => ({ current: null }),
                },
                "./AdminVotingContext": { useAdminVotingContext:
                    /* Return the use admin voting context fixture for this scenario. */
                    () => ({ question }) },
                "../../admin/api": {
                    // Record admin post calls for assertions.
                    adminPost: async (url, payload) => {
                        requests.push({ url, payload });
                    },
                },
                "react-toastify": { toast: { promise: /* Return promise to the caller. */ (promise) => promise } },
            };
            return Object.hasOwn(dependencies, specifier)
                ? dependencies[specifier]
                : requireFromComponent(specifier);
        },
    }, { filename: componentPath });

    return { QuestionDisplay: module.exports.default, updates, requests };
}

// Find the first rendered element matching a predicate.
function find(node, predicate) {
    if (!React.isValidElement(node)) return null;
    if (predicate(node)) return node;
    return React.Children.toArray(node.props.children)
        .map(/* Invoke find with the test inputs. */ (child) => find(child, predicate)).find(Boolean) ?? null;
}

test("new admin question posts before clearing the old votes", async () => {
    // Verify new admin question posts before clearing the old votes.
    const { QuestionDisplay, updates, requests } = await loadQuestion();
    const tree = QuestionDisplay();
    const button = find(tree, /* Identify the Send Question button. */ (node) => node.type === "button" && node.props.children === "Send Question");
    await button.props.onClick();

    assert.deepEqual(requests.map(/* Return the fixture for this scenario. */ ({ url, payload }) => ({ url, payload: { ...payload } })), [
        { url: "/api/admin/voting/post-question", payload: { question: "New?" } },
        { url: "/api/admin/voting/clear-votes", payload: {} },
    ]);
    assert.deepEqual(updates, [[0, false]]);
});

test("unchanged question skips requests, while Cancel restores the current question", async () => {
    // Verify unchanged question skips requests, while Cancel restores the current question.
    const { QuestionDisplay, updates, requests } = await loadQuestion({ inputValue: " Current? " });
    const tree = QuestionDisplay();
    const send = find(tree, /* Identify the Send Question button. */ (node) => node.type === "button" && node.props.children === "Send Question");
    const cancel = find(tree, /* Identify the Cancel button. */ (node) => node.type === "button" && node.props.children === "Cancel");

    await send.props.onClick();
    cancel.props.onClick();

    assert.deepEqual(requests, []);
    assert.deepEqual(updates, [[0, false], [1, "Current?"], [0, false]]);
});
