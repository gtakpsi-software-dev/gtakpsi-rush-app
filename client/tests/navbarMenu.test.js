import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../src/features/navigation/NavbarMenu.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("./fixtures/navbarMenu.json", import.meta.url));

// The link stub keeps snapshots focused on Navbar's markup, independent of router internals.
// eslint-disable-next-line react/prop-types
const Link = ({ to, children, ...props }) => React.createElement("a", { ...props, href: to }, children);

function props(overrides = {}) {
    return {
        stripped: false,
        isMidtermMode: false,
        isBidcom: false,
        isAdmin: false,
        showMore: false,
        showAdmin: false,
        setShowMore() {},
        setShowAdmin() {},
        logout() {},
        reload() {},
        ...overrides,
    };
}

function collect(node, elements = []) {
    if (Array.isArray(node)) {
        node.forEach((child) => collect(child, elements));
    } else if (React.isValidElement(node)) {
        elements.push(node);
        collect(node.props.children, elements);
    }
    return elements;
}

test("Navbar menu preserves regular, role, midterm, and stripped markup", async () => {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const NavbarMenu = await loadTsxComponent(componentPath, { "react-router-dom": { Link } });
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
    const NavbarMenu = await loadTsxComponent(componentPath, { "react-router-dom": { Link } });
    const calls = [];
    const elements = collect(NavbarMenu(props({
        isAdmin: true,
        showAdmin: true,
        setShowMore: (value) => calls.push(["more", value]),
        setShowAdmin: (value) => calls.push(["admin", value]),
        logout: () => calls.push(["logout"]),
        reload: () => calls.push(["reload"]),
    })));

    const button = (label) => elements.find((element) =>
        element.type === "button" && element.props.children === label);
    button("More ▾").props.onClick();
    button("Admin ▾").props.onClick();
    elements.find((element) => element.type === "p" && element.props.children === "Logout")
        .props.onClick();

    assert.deepEqual(calls, [
        ["more", true], ["admin", false],
        ["admin", false], ["more", false],
        ["logout"], ["reload"],
    ]);
});
