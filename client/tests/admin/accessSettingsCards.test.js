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

async function loadCards() {
    const AccessToggleRow = await loadTsxComponent(togglePath);
    return loadTsxComponent(componentPath, { './AccessToggleRow': AccessToggleRow });
}

function props(overrides = {}) {
    return {
        rushAppStatus: { disable_bidcom: false, disable_regular: false, midterm_mode: false },
        rushAppLoading: false,
        handleToggleRushAppAccess() {},
        commentVisibilityStatus: { require_comment_to_view: true },
        commentVisibilityLoading: false,
        handleToggleCommentVisibility() {},
        midtermLoading: false,
        handleToggleMidtermMode() {},
        ...overrides,
    };
}

test("access settings retain normal, restricted, busy, and partial-disable markup", async () => {
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
    const AccessSettingsCards = await loadCards();
    const calls = [];
    const tree = AccessSettingsCards(props({
        handleToggleRushAppAccess: (field, value) => calls.push([field, value]),
        handleToggleCommentVisibility: (value) => calls.push(["comments", value]),
        handleToggleMidtermMode: (value) => calls.push(["midterm", value]),
    }));
    const buttons = [];
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
    assert.ok(buttons.every((button) => button.props.disabled === false));
    buttons.forEach((button) => button.props.onClick());
    assert.deepEqual(calls, [
        ["disable_bidcom", true],
        ["disable_regular", true],
        ["comments", false],
        ["midterm", true],
    ]);
});
