import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const fixturePath = fileURLToPath(new URL("../fixtures/accessSettingsCards.json", import.meta.url));
const componentPath = fileURLToPath(new URL("../../src/features/admin/access/AccessSettingsCards.tsx", import.meta.url));
const togglePath = fileURLToPath(new URL("../../src/features/admin/access/AccessToggleRow.tsx", import.meta.url));

// Load cards with injected dependencies for isolated tests.
async function loadCards() {
    const AccessToggleRow = await loadTsxComponent(togglePath);
    return loadTsxComponent(componentPath, { './AccessToggleRow': AccessToggleRow });
}

// Build component props with test-specific overrides.
function props(overrides = {}) {
    return {
        rushAppStatus: { disable_bidcom: false, disable_regular: false, midterm_mode: false },
        rushAppLoading: false,
        // Provide an inert handle toggle rush app access stub for this test.
        handleToggleRushAppAccess() {},
        commentVisibilityStatus: { require_comment_to_view: true },
        commentVisibilityLoading: false,
        // Provide an inert handle toggle comment visibility stub for this test.
        handleToggleCommentVisibility() {},
        midtermLoading: false,
        // Provide an inert handle toggle midterm mode stub for this test.
        handleToggleMidtermMode() {},
        ...overrides,
    };
}

test("access settings retain normal, restricted, busy, and partial-disable markup", async () => {
    // Verify access settings retain normal, restricted, busy, and partial-disable markup.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const AccessSettingsCards = await loadCards();
    const scenarios = {
        normal: {},
        restricted: {
            rushAppStatus: { disable_bidcom: true, disable_regular: true, midterm_mode: true },
            commentVisibilityStatus: { require_comment_to_view: false },
        },
        busy: { rushAppLoading: true, commentVisibilityLoading: true, midtermLoading: true },
        bidcom_only: { rushAppStatus: { disable_bidcom: true, disable_regular: false, midterm_mode: false } },
    };

    for (const [scenario, values] of Object.entries(scenarios)) {
        const html = renderToStaticMarkup(React.createElement(AccessSettingsCards, props(values)));
        const hash = createHash("sha256").update(html).digest("hex");
        assert.equal(hash, expected[scenario], `${scenario} markup changed`);
    }
});

test("each access toggle keeps its original request field and value", async () => {
    // Verify each access toggle keeps its original request field and value.
    const AccessSettingsCards = await loadCards();
    const calls = [];
    const tree = AccessSettingsCards(props({
        // Record handle toggle rush app access calls for assertions.
        handleToggleRushAppAccess: (field, value) => calls.push([field, value]),
        // Record handle toggle comment visibility calls for assertions.
        handleToggleCommentVisibility: (value) => calls.push(["comments", value]),
        // Record handle toggle midterm mode calls for assertions.
        handleToggleMidtermMode: (value) => calls.push(["midterm", value]),
    }));
    const buttons = [];
    // Walk the rendered element tree to collect nodes for assertions.
    function collect(node) {
        if (Array.isArray(node)) {
            node.forEach(collect);
        } else if (React.isValidElement(node)) {
            if (node.type === "button") buttons.push(node);
            if (typeof node.type === 'function') {
                collect(node.type(node.props));
            } else {
                collect(node.props.children);
            }
        }
    }
    collect(tree);

    assert.equal(buttons.length, 4);
    assert.ok(buttons.every(/* Check that the control is enabled. */ (button) => button.props.disabled === false));
    buttons.forEach(/* Invoke button.props.onClick with the test inputs. */ (button) => button.props.onClick());
    assert.deepEqual(calls, [
        ["disable_bidcom", true],
        ["disable_regular", true],
        ["comments", false],
        ["midterm", true],
    ]);
});
