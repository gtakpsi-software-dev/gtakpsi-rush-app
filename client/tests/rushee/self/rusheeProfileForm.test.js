import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MAJOR_OPTIONS } from "../../../src/data/majorOptions.js";
import { PRONOUN_OPTIONS, YEAR_OPTIONS } from "../../../src/data/profileOptions.js";
import { formatPhoneInput } from "../../../src/lib/formatPhoneInput.js";
import { loadTsxComponent } from "../../helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../../../src/features/rushee/self/RusheeProfileForm.tsx", import.meta.url));
const contactPath = fileURLToPath(new URL("../../../src/features/rushee/self/RusheeProfileContactFields.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("../../fixtures/rusheeProfileForm.json", import.meta.url));
const rushee = {
    first_name: "Ada", last_name: "One", housing: "Hall",
    phone_number: "(404) 555-1234", email: "ada@example.com", gtid: "123456789",
    major: "Computer Science", class: "Third", pronouns: "she/her",
};

// Load form with injected dependencies for isolated tests.
async function loadForm() {
    const RusheeProfileContactFields = await loadTsxComponent(contactPath, {
        "../../../lib/formatPhoneInput.js": { formatPhoneInput },
    });
    return loadTsxComponent(componentPath, {
        "../../../data/majorOptions.js": { MAJOR_OPTIONS },
        "../../../data/profileOptions.js": { PRONOUN_OPTIONS, YEAR_OPTIONS },
        "./RusheeProfileContactFields": RusheeProfileContactFields,
    });
}

// Walk the rendered element tree to collect nodes for assertions.
function collect(node, elements = []) {
    if (Array.isArray(node)) {
        node.forEach(/* Invoke collect with the test inputs. */ (child) => collect(child, elements));
    } else if (React.isValidElement(node)) {
        elements.push(node);
        if (typeof node.type === "function") collect(node.type(node.props), elements);
        else collect(node.props.children, elements);
    }
    return elements;
}

test("self-profile form retains its pre-extraction fields, labels, options, and styling", async () => {
    // Verify self-profile form retains its pre-extraction fields, labels, options, and styling.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const RusheeProfileForm = await loadForm();
    const html = renderToStaticMarkup(React.createElement(RusheeProfileForm, {
        rushee,
            /* Provide an inert on submit stub for this test. */
            onSubmit() {},
            /* Provide an inert on change stub for this test. */
            onChange() {},
    }));
    assert.equal(createHash("sha256").update(html).digest("hex"), expected.filled);
});

test("form keeps the original submit and regular field handlers", async () => {
    // Verify form keeps the original submit and regular field handlers.
    const RusheeProfileForm = await loadForm();
    const calls = [];
    // Record on submit calls for assertions.
    const onSubmit = (event) => calls.push(["submit", event]);
    // Record on change calls for assertions.
    const onChange = (event) => calls.push(["change", event]);
    const nodes = collect(RusheeProfileForm({ rushee, onSubmit, onChange }));
    const form = nodes.find(/* Identify rendered form elements. */ (node) => node.type === "form");
    const firstName = nodes.find(/* Identify rendered input elements. */ (node) => node.type === "input" && node.props.name === "first_name");
    assert.equal(form.props.onSubmit, onSubmit);
    assert.equal(firstName.props.value, "Ada");
    assert.equal(firstName.props.onChange, onChange);
    const event = { target: { name: "first_name", value: "Adaline" } };
    firstName.props.onChange(event);
    form.props.onSubmit(event);
    assert.deepEqual(calls, [["change", event], ["submit", event]]);
});

test("phone input mutates the event with the existing partial and full formats", async () => {
    // Verify phone input mutates the event with the existing partial and full formats.
    const RusheeProfileForm = await loadForm();
    const calls = [];
    const nodes = collect(RusheeProfileForm({
        rushee,
            /* Provide an inert on submit stub for this test. */
            onSubmit() {}, onChange:
            /* Record on change calls for assertions. */
            (event) => calls.push(event),
    }));
    const phone = nodes.find(/* Identify rendered input elements. */ (node) => node.type === "input" && node.props.name === "phone_number");
    for (const [raw, expected] of [
        ["4", "(4"], ["404555", "(404) 555"],
        ["4045551234", "(404) 555-1234"], ["4045551", "4045551"],
        ["abc", ""],
    ]) {
        const event = { target: { name: "phone_number", value: raw } };
        phone.props.onChange(event);
        assert.equal(event.target.value, expected);
        assert.equal(calls.at(-1), event);
    }
});

test("profile contact values and regular changes still reach their inputs", async () => {
    // Verify profile contact values and regular changes still reach their inputs.
    const RusheeProfileForm = await loadForm();
    // Provide an inert on change stub for this test.
    const onChange = () => {};
    const nodes = collect(RusheeProfileForm({ rushee, /* Provide an inert on submit stub for this test. */ onSubmit() {}, onChange }));
    for (const [name, value] of [
        ["housing", "Hall"],
        ["email", "ada@example.com"],
        ["gtid", "123456789"],
    ]) {
        const input = nodes.find(/* Identify rendered input elements. */ (node) => node.type === "input" && node.props.name === name);
        assert.equal(input.props.value, value);
        assert.equal(input.props.onChange, onChange);
    }
});
