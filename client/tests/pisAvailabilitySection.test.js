import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const fixturePath = fileURLToPath(new URL("./fixtures/pisAvailabilitySection.json", import.meta.url));
const componentPath = fileURLToPath(new URL("../src/features/admin/availability/PisAvailabilitySection.tsx", import.meta.url));
const submissionsCardPath = fileURLToPath(new URL("../src/features/admin/availability/PisAvailabilitySubmissionsCard.tsx", import.meta.url));
const submissions = [
    { brother_first_name: "Ada", brother_last_name: "Example", available_timeslots: [{}, {}] },
    { brother_first_name: "Bob", brother_last_name: "Example", available_timeslots: [] },
];

function props(overrides = {}) {
    return {
        pisFormStatus: { is_active: false, sent_at: null },
        pisFormLoading: false,
        brotherAvailabilities: [],
        handleSendPISForm() {},
        handleDeactivatePISForm() {},
        handleClearAndResendPISForm() {},
        openEditAvailability() {},
        handleAutoAssignBrothers() {},
        handleClearAssignments() {},
        exportPISWithBrothers() {},
        ...overrides,
    };
}

function buttonsIn(node, buttons = []) {
    if (Array.isArray(node)) node.forEach((child) => buttonsIn(child, buttons));
    else if (React.isValidElement(node)) {
        if (typeof node.type === "function") return buttonsIn(node.type(node.props), buttons);
        if (node.type === "button") buttons.push(node);
        buttonsIn(node.props.children, buttons);
    }
    return buttons;
}

async function loadSection() {
    const Card = await loadTsxComponent(submissionsCardPath);
    return loadTsxComponent(componentPath, {
        "./PisAvailabilitySubmissionsCard": Card,
    });
}

test("PIS availability section retains inactive, active, busy, and submission markup", async () => {
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
    const PisAvailabilitySection = await loadSection();
    const calls = [];
    const handlers = {
        handleSendPISForm: () => calls.push("send"),
        handleDeactivatePISForm: () => calls.push("deactivate"),
        handleClearAndResendPISForm: () => calls.push("resend"),
        openEditAvailability: (brother) => calls.push(["edit", brother]),
        handleAutoAssignBrothers: () => calls.push("assign"),
        handleClearAssignments: () => calls.push("clear"),
        exportPISWithBrothers: () => calls.push("export"),
    };

    const inactive = buttonsIn(PisAvailabilitySection(props(handlers)));
    assert.deepEqual(inactive.map((button) => button.props.disabled), [false, true, false, undefined]);
    inactive[0].props.onClick();

    const active = buttonsIn(PisAvailabilitySection(props({
        ...handlers,
        pisFormStatus: { is_active: true, sent_at: null },
        brotherAvailabilities: [submissions[0]],
    })));
    assert.equal(active.length, 6);
    assert.ok(active.every((button) => button.props.disabled !== true));
    active.forEach((button) => button.props.onClick());
    assert.deepEqual(calls, [
        "send", "deactivate", "resend", ["edit", submissions[0]], "assign", "clear", "export",
    ]);
});

test("a submission without timeslots still shows zero and opens that brother", async () => {
    const Card = await loadTsxComponent(submissionsCardPath);
    const brother = { brother_first_name: "Ada", brother_last_name: "Example" };
    const opened = [];
    const cardProps = {
        brotherAvailabilities: [brother],
        onEditAvailability: (value) => opened.push(value),
    };

    const html = renderToStaticMarkup(React.createElement(Card, cardProps));
    assert.match(html, /Ada Example<span[^>]*>\(0\)<\/span>/);
    buttonsIn(Card(cardProps))[0].props.onClick();
    assert.deepEqual(opened, [brother]);
});
