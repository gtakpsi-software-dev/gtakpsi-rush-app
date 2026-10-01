import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import React from "react";
import { transformWithEsbuild } from "vite";

const componentPath = fileURLToPath(new URL("../src/pages/AdminVotingDashboard/QuestionDisplay.tsx", import.meta.url));

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
        require(specifier) {
            const dependencies = {
                react: {
                    ...React,
                    useState(initial) {
                        const index = stateIndex++;
                        return [states[index] ?? initial, (value) => updates.push([index, value])];
                    },
                    useRef: () => ({ current: null }),
                },
                "./AdminVotingContext": { useAdminVotingContext: () => ({ question }) },
                "../../features/admin/api": {
                    adminPost: async (url, payload) => {
                        requests.push({ url, payload });
                    },
                },
                "react-toastify": { toast: { promise: (promise) => promise } },
            };
            return Object.hasOwn(dependencies, specifier)
                ? dependencies[specifier]
                : requireFromComponent(specifier);
        },
    }, { filename: componentPath });

    return { QuestionDisplay: module.exports.default, updates, requests };
}

function find(node, predicate) {
    if (!React.isValidElement(node)) return null;
    if (predicate(node)) return node;
    return React.Children.toArray(node.props.children)
        .map((child) => find(child, predicate)).find(Boolean) ?? null;
}

test("new admin question posts before clearing the old votes", async () => {
    const { QuestionDisplay, updates, requests } = await loadQuestion();
    const tree = QuestionDisplay();
    const button = find(tree, (node) => node.type === "button" && node.props.children === "Send Question");
    await button.props.onClick();

    assert.deepEqual(requests.map(({ url, payload }) => ({ url, payload: { ...payload } })), [
        { url: "/api/admin/voting/post-question", payload: { question: "New?" } },
        { url: "/api/admin/voting/clear-votes", payload: {} },
    ]);
    assert.deepEqual(updates, [[0, false]]);
});

test("unchanged question skips requests, while Cancel restores the current question", async () => {
    const { QuestionDisplay, updates, requests } = await loadQuestion({ inputValue: " Current? " });
    const tree = QuestionDisplay();
    const send = find(tree, (node) => node.type === "button" && node.props.children === "Send Question");
    const cancel = find(tree, (node) => node.type === "button" && node.props.children === "Cancel");

    await send.props.onClick();
    cancel.props.onClick();

    assert.deepEqual(requests, []);
    assert.deepEqual(updates, [[0, false], [1, "Current?"], [0, false]]);
});
