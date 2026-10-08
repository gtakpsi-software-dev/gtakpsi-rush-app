import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const fixturePath = fileURLToPath(new URL("../fixtures/adminAccessCard.json", import.meta.url));
const componentPath = fileURLToPath(new URL("../../src/features/admin/access/AdminAccessCard.tsx", import.meta.url));
const brother = { id: "brother-1", firstname: "Ada", lastname: "Example", email: "ada@example.org" };

// Build component props with test-specific overrides.
function props(overrides = {}) {
    return {
        brotherSearch: "",
        // Provide an inert set brother search stub for this test.
        setBrotherSearch() {},
        selectedBrother: null,
        // Provide an inert set selected brother stub for this test.
        setSelectedBrother() {},
        filteredBrothers: [],
        // Provide an inert handle select brother stub for this test.
        handleSelectBrother() {},
        brotherAdminStatus: null,
        brotherBidcomStatus: null,
        isPromoting: false,
        // Provide an inert handle set admin stub for this test.
        handleSetAdmin() {},
        // Provide an inert handle set bidcom stub for this test.
        handleSetBidcom() {},
        ...overrides,
    };
}

// Walk the rendered element tree to collect nodes for assertions.
function collect(node, elements = []) {
    if (Array.isArray(node)) {
        node.forEach(/* Invoke collect with the test inputs. */ (child) => collect(child, elements));
    } else if (React.isValidElement(node)) {
        elements.push(node);
        collect(node.props.children, elements);
    }
    return elements;
}

test("admin access card retains idle, search, selected, and updating markup", async () => {
    // Verify admin access card retains idle, search, selected, and updating markup.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const AdminAccessCard = await loadTsxComponent(componentPath);
    const scenarios = {
        idle: {},
        search: { brotherSearch: "Ada", filteredBrothers: [brother, { uid: "brother-2", firstName: "Bea", lastName: "Example", email: "bea@example.org" }] },
        selected: { brotherSearch: brother.email, selectedBrother: brother, brotherAdminStatus: true, brotherBidcomStatus: false },
        promoting: { brotherSearch: brother.email, selectedBrother: brother, brotherAdminStatus: false, brotherBidcomStatus: true, isPromoting: true },
    };

    for (const [scenario, values] of Object.entries(scenarios)) {
        const html = renderToStaticMarkup(React.createElement(AdminAccessCard, props(values)));
        const hash = createHash("sha256").update(html).digest("hex");
        assert.equal(hash, expected[scenario], `${scenario} markup changed`);
    }
});

test("admin access search preserves selection and reset behavior", async () => {
    // Verify admin access search preserves selection and reset behavior.
    const AdminAccessCard = await loadTsxComponent(componentPath);
    const calls = [];
    const elements = collect(AdminAccessCard(props({
        brotherSearch: brother.email,
        selectedBrother: brother,
        // Record set brother search calls for assertions.
        setBrotherSearch: (value) => calls.push(["search", value]),
        // Record set selected brother calls for assertions.
        setSelectedBrother: (value) => calls.push(["selected", value]),
    })));
    const search = elements.find(
        /* Find the input with placeholder Search brother by name or email.... */
        (element) => element.type === "input" && element.props.placeholder === "Search brother by name or email...");

    search.props.onChange({ target: { value: brother.email } });
    search.props.onChange({ target: { value: "different" } });
    assert.deepEqual(calls, [["search", brother.email], ["search", "different"], ["selected", null]]);

    const candidates = collect(AdminAccessCard(props({
        filteredBrothers: [brother],
        // Record handle select brother calls for assertions.
        handleSelectBrother: (value) => calls.push(["choose", value]),
    })));
    const candidate = candidates.find(
        /* Identify elements with the expected styling classes. */
        (element) => element.props.className?.includes("last:border-b-0"));
    candidate.props.onClick();
    assert.equal(calls.at(-1)[1], brother);
});

test("admin and bid committee buttons retain role actions and disabled states", async () => {
    // Verify admin and bid committee buttons retain role actions and disabled states.
    const AdminAccessCard = await loadTsxComponent(componentPath);
    const calls = [];
    const elements = collect(AdminAccessCard(props({
        selectedBrother: brother,
        brotherAdminStatus: true,
        brotherBidcomStatus: false,
        // Record handle set admin calls for assertions.
        handleSetAdmin: (value) => calls.push(["admin", value]),
        // Record handle set bidcom calls for assertions.
        handleSetBidcom: (value) => calls.push(["bidcom", value]),
    })));
    const buttons = elements.filter(/* Identify rendered button elements. */ (element) => element.type === "button");
    // Invoke buttons.find with the test inputs.
    const button = (label) => buttons.find(/* Match the control by its displayed label. */ (element) => element.props.children === label);

    assert.equal(button("Grant Admin").props.disabled, true);
    assert.equal(button("Remove Admin").props.disabled, false);
    assert.equal(button("Grant Bid Com").props.disabled, false);
    assert.equal(button("Remove Bid Com").props.disabled, true);
    button("Grant Admin").props.onClick();
    button("Remove Admin").props.onClick();
    button("Grant Bid Com").props.onClick();
    button("Remove Bid Com").props.onClick();
    assert.deepEqual(calls, [["admin", true], ["admin", false], ["bidcom", true], ["bidcom", false]]);
});
