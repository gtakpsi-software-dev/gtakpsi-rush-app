import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const fixturePath = fileURLToPath(new URL("../fixtures/pisAvailabilitySection.json", import.meta.url));
const componentPath = fileURLToPath(new URL("../../src/features/admin/availability/PisAvailabilitySection.tsx", import.meta.url));
const formCardPath = fileURLToPath(new URL("../../src/features/admin/availability/PisAvailabilityFormCard.tsx", import.meta.url));
const submissionsCardPath = fileURLToPath(new URL("../../src/features/admin/availability/PisAvailabilitySubmissionsCard.tsx", import.meta.url));
const submissions = [
    { brother_first_name: "Ada", brother_last_name: "Example", available_timeslots: [{}, {}] },
    { brother_first_name: "Bob", brother_last_name: "Example", available_timeslots: [] },
];

// Build component props with test-specific overrides.
function props(overrides = {}) {
    return {
        pisFormStatus: { is_active: false, sent_at: null },
        pisFormLoading: false,
        brotherAvailabilities: [],
        // Provide an inert handle send pisform stub for this test.
        handleSendPISForm() {},
        // Provide an inert handle deactivate pisform stub for this test.
        handleDeactivatePISForm() {},
        // Provide an inert handle clear and resend pisform stub for this test.
        handleClearAndResendPISForm() {},
        // Provide an inert open edit availability stub for this test.
        openEditAvailability() {},
        // Provide an inert handle auto assign brothers stub for this test.
        handleAutoAssignBrothers() {},
        // Provide an inert handle clear assignments stub for this test.
        handleClearAssignments() {},
        // Provide an inert export piswith brothers stub for this test.
        exportPISWithBrothers() {},
        ...overrides,
    };
}

// Walk the rendered element tree to collect nodes for assertions.
function buttonsIn(node, buttons = []) {
    if (Array.isArray(node)) node.forEach(/* Invoke buttonsIn with the test inputs. */ (child) => buttonsIn(child, buttons));
    else if (React.isValidElement(node)) {
        if (typeof node.type === "function") return buttonsIn(node.type(node.props), buttons);
        if (node.type === "button") buttons.push(node);
        buttonsIn(node.props.children, buttons);
    }
    return buttons;
}

// Load section with injected dependencies for isolated tests.
async function loadSection() {
    const FormCard = await loadTsxComponent(formCardPath);
    const Card = await loadTsxComponent(submissionsCardPath);
    return loadTsxComponent(componentPath, {
        "./PisAvailabilityFormCard": FormCard,
        "./PisAvailabilitySubmissionsCard": Card,
    });
}

test("PIS availability section retains inactive, active, busy, and submission markup", async () => {
    // Verify PIS availability section retains inactive, active, busy, and submission markup.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const PisAvailabilitySection = await loadSection();
    const scenarios = {
        inactive: {},
        active: { pisFormStatus: { is_active: true, sent_at: null } },
        busy: { pisFormStatus: { is_active: true, sent_at: null }, pisFormLoading: true },
        submissions: { brotherAvailabilities: submissions },
    };

    for (const [scenario, values] of Object.entries(scenarios)) {
        const html = renderToStaticMarkup(React.createElement(PisAvailabilitySection, props(values)));
        assert.equal(createHash("sha256").update(html).digest("hex"), expected[scenario], `${scenario} markup changed`);
    }
});

test("last-sent label accepts ISO and extended-JSON dates", async () => {
    // Verify last-sent label accepts ISO and extended-JSON dates.
    const PisAvailabilitySection = await loadSection();
    const timestamp = Date.parse("2026-10-01T12:00:00Z");
    const values = [new Date(timestamp).toISOString(), { $date: { $numberLong: String(timestamp) } }];

    for (const sent_at of values) {
        const html = renderToStaticMarkup(React.createElement(PisAvailabilitySection, props({
            pisFormStatus: { is_active: true, sent_at },
        })));
        assert.ok(html.includes(`Last sent: ${new Date(timestamp).toLocaleString()}`));
    }
});

test("availability actions retain their callbacks and disabled states", async () => {
    // Verify availability actions retain their callbacks and disabled states.
    const PisAvailabilitySection = await loadSection();
    const calls = [];
    const handlers = {
        // Record handle send pisform calls for assertions.
        handleSendPISForm: () => calls.push("send"),
        // Record handle deactivate pisform calls for assertions.
        handleDeactivatePISForm: () => calls.push("deactivate"),
        // Record handle clear and resend pisform calls for assertions.
        handleClearAndResendPISForm: () => calls.push("resend"),
        // Record open edit availability calls for assertions.
        openEditAvailability: (brother) => calls.push(["edit", brother]),
        // Record handle auto assign brothers calls for assertions.
        handleAutoAssignBrothers: () => calls.push("assign"),
        // Record handle clear assignments calls for assertions.
        handleClearAssignments: () => calls.push("clear"),
        // Record export piswith brothers calls for assertions.
        exportPISWithBrothers: () => calls.push("export"),
    };

    const inactive = buttonsIn(PisAvailabilitySection(props(handlers)));
    assert.deepEqual(inactive.map(/* Read each button's disabled state. */ (button) => button.props.disabled), [false, true, false, undefined]);
    inactive[0].props.onClick();

    const active = buttonsIn(PisAvailabilitySection(props({
        ...handlers,
        pisFormStatus: { is_active: true, sent_at: null },
        brotherAvailabilities: [submissions[0]],
    })));
    assert.equal(active.length, 6);
    assert.ok(active.every(/* Check the disabled state of the control. */ (button) => button.props.disabled !== true));
    active.forEach(/* Invoke button.props.onClick with the test inputs. */ (button) => button.props.onClick());
    assert.deepEqual(calls, [
        "send", "deactivate", "resend", ["edit", submissions[0]], "assign", "clear", "export",
    ]);
});

test("a submission without timeslots still shows zero and opens that brother", async () => {
    // Verify a submission without timeslots still shows zero and opens that brother.
    const Card = await loadTsxComponent(submissionsCardPath);
    const brother = { brother_first_name: "Ada", brother_last_name: "Example" };
    const opened = [];
    const cardProps = {
        brotherAvailabilities: [brother],
        // Record on edit availability calls for assertions.
        onEditAvailability: (value) => opened.push(value),
    };

    const html = renderToStaticMarkup(React.createElement(Card, cardProps));
    assert.match(html, /Ada Example<span[^>]*>\(0\)<\/span>/);
    buttonsIn(Card(cardProps))[0].props.onClick();
    assert.deepEqual(opened, [brother]);
});

test("loading disables the form and assignment actions while leaving export available", async () => {
    // Verify loading disables the form and assignment actions while leaving export available.
    const PisAvailabilitySection = await loadSection();
    const active = buttonsIn(PisAvailabilitySection(props({
        pisFormStatus: { is_active: true, sent_at: null },
        pisFormLoading: true,
    })));
    assert.deepEqual(active.map(/* Read each button's disabled state. */ (button) => button.props.disabled), [
        true, true, true, true, undefined,
    ]);
});
