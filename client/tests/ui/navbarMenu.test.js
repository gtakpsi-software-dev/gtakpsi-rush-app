import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../../src/features/navigation/NavbarMenu.tsx", import.meta.url));
const moreItemsPath = fileURLToPath(new URL("../../src/features/navigation/NavbarMoreItems.tsx", import.meta.url));
const adminItemsPath = fileURLToPath(new URL("../../src/features/navigation/NavbarAdminItems.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("../fixtures/navbarMenu.json", import.meta.url));

// The link stub keeps snapshots focused on Navbar's markup, independent of router internals.
// eslint-disable-next-line react/prop-types
// Render a lightweight React element for component assertions.
const Link = ({ to, children, ...props }) => React.createElement("a", { ...props, href: to }, children);

// Load navbar menu with injected dependencies for isolated tests.
async function loadNavbarMenu() {
    const MoreItems = await loadTsxComponent(moreItemsPath);
    const AdminItems = await loadTsxComponent(adminItemsPath);
    return loadTsxComponent(componentPath, {
        "react-router-dom": { Link },
        "./NavbarMoreItems": MoreItems,
        "./NavbarAdminItems": AdminItems,
    });
}

// Build component props with test-specific overrides.
function props(overrides = {}) {
    return {
        stripped: false,
        isMidtermMode: false,
        isBidcom: false,
        isAdmin: false,
        showMore: false,
        showAdmin: false,
        // Provide an inert set show more stub for this test.
        setShowMore() {},
        // Provide an inert set show admin stub for this test.
        setShowAdmin() {},
        // Provide an inert logout stub for this test.
        logout() {},
        // Provide an inert reload stub for this test.
        reload() {},
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

test("Navbar menu preserves regular, role, midterm, and stripped markup", async () => {
    // Verify Navbar menu preserves regular, role, midterm, and stripped markup.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const NavbarMenu = await loadNavbarMenu();
    const scenarios = {
        regular: {},
        bidcomMoreOpen: { isBidcom: true, showMore: true },
        adminOpen: { isAdmin: true, showAdmin: true },
        midterm: { isMidtermMode: true },
        midtermAdminOpen: { isMidtermMode: true, isAdmin: true, showAdmin: true },
        stripped: { stripped: true },
    };

    for (const [name, overrides] of Object.entries(scenarios)) {
        const html = renderToStaticMarkup(React.createElement(NavbarMenu, props(overrides)));
        const hash = createHash("sha256").update(html).digest("hex");
        assert.equal(hash, expected[name], `${name} menu markup changed`);
    }
});

test("menu buttons retain toggle ordering and logout calls before reload", async () => {
    // Verify menu buttons retain toggle ordering and logout calls before reload.
    const NavbarMenu = await loadNavbarMenu();
    const calls = [];
    const elements = collect(NavbarMenu(props({
        isAdmin: true,
        showAdmin: true,
        // Record set show more calls for assertions.
        setShowMore: (value) => calls.push(["more", value]),
        // Record set show admin calls for assertions.
        setShowAdmin: (value) => calls.push(["admin", value]),
        // Record logout calls for assertions.
        logout: () => calls.push(["logout"]),
        // Record reload calls for assertions.
        reload: () => calls.push(["reload"]),
    })));

    // Invoke elements.find with the test inputs.
    const button = (label) => elements.find(/* Find the button with label label. */ (element) =>
        element.type === "button" && element.props.children === label);
    button("More ▾").props.onClick();
    button("Admin ▾").props.onClick();
    elements.find(/* Find the p with label Logout. */ (element) => element.type === "p" && element.props.children === "Logout")
        .props.onClick();

    assert.deepEqual(calls, [
        ["more", true], ["admin", false],
        ["admin", false], ["more", false],
        ["logout"], ["reload"],
    ]);
});
