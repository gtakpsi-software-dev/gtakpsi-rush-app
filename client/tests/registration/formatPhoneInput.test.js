import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";

import React from "react";
import { formatPhoneInput } from "../../src/lib/formatPhoneInput.js";
import { MAJOR_OPTIONS } from "../../src/data/majorOptions.js";
import { PRONOUN_OPTIONS, YEAR_OPTIONS } from "../../src/data/profileOptions.js";
import { EXPOSURE_OPTIONS } from "../../src/features/registration/basicInfoOptions.js";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const fieldsPath = fileURLToPath(new URL("../../src/features/registration/BasicInfoFields.tsx", import.meta.url));
const contactPath = fileURLToPath(new URL("../../src/features/registration/BasicContactFields.tsx", import.meta.url));

// Load fields with injected dependencies for isolated tests.
async function loadFields() {
    const BasicContactFields = await loadTsxComponent(contactPath, {
        "../../lib/formatPhoneInput.js": { formatPhoneInput },
    });
    return loadTsxComponent(fieldsPath, {
        "./BasicContactFields": BasicContactFields,
        "../../data/majorOptions.js": { MAJOR_OPTIONS },
        "../../data/profileOptions.js": { PRONOUN_OPTIONS, YEAR_OPTIONS },
        "./basicInfoOptions.js": { EXPOSURE_OPTIONS },
    });
}

// Find the rendered input with the requested ID.
function findInput(node, id) {
    if (Array.isArray(node)) return node.map(/* Invoke findInput with the test inputs. */ (child) => findInput(child, id)).find(Boolean);
    if (!React.isValidElement(node)) return null;
    if (typeof node.type === "function") return findInput(node.type(node.props), id);
    if (node.props.id === id) return node;
    return findInput(node.props.children, id);
}

test("registration phone input keeps the existing partial and full formatting", () => {
    // Verify registration phone input keeps the existing partial and full formatting.
    for (const [input, expected] of [
        ["", ""],
        ["1", "(1"],
        ["123", "(123"],
        ["1234", "(123) 4"],
        ["123456", "(123) 456"],
        ["1234567", "1234567"],
        ["123456789", "123456789"],
        ["1234567890", "(123) 456-7890"],
        ["12345678901", "12345678901"],
        ["(123) 456-7890", "(123) 456-7890"],
        ["1a2b3c", "(123"],
    ]) {
        assert.equal(formatPhoneInput(input), expected, input);
    }
});

test("the registration phone field still formats its target on change", async () => {
    // Verify the registration phone field still formats its target on change.
    const BasicInfoFields = await loadFields();
    const tree = BasicInfoFields({});
    const phone = findInput(tree, "grid-phone");
    assert.ok(phone);
    const event = { target: { value: "404-555-0100" } };
    phone.props.onChange(event);
    assert.equal(event.target.value, "(404) 555-0100");
});

test("contact inputs keep the registration form's refs", async () => {
    // Verify contact inputs keep the registration form's refs.
    const BasicInfoFields = await loadFields();
    const refs = {
        email: { current: null },
        housing: { current: null },
        phone: { current: null },
    };
    const tree = BasicInfoFields(refs);

    for (const [field, id] of [
        ["email", "grid-email"],
        ["housing", "grid-housing"],
        ["phone", "grid-phone"],
    ]) {
        assert.equal(findInput(tree, id).ref, refs[field]);
    }
});
