import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";

import React from "react";
import { formatPhoneInput } from "../src/features/registration/formatPhoneInput.js";
import { MAJOR_OPTIONS, EXPOSURE_OPTIONS } from "../src/features/registration/basicInfoOptions.js";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

test("registration phone input keeps the existing partial and full formatting", () => {
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
    const componentPath = fileURLToPath(new URL("../src/features/registration/BasicInfoForm.tsx", import.meta.url));
    const BasicInfoForm = await loadTsxComponent(componentPath, {
        "./formatPhoneInput.js": { formatPhoneInput },
        "./basicInfoOptions.js": { MAJOR_OPTIONS, EXPOSURE_OPTIONS },
    });
    const tree = BasicInfoForm({});

    function findPhone(node) {
        if (Array.isArray(node)) {
            return node.map(findPhone).find(Boolean);
        }
        if (!React.isValidElement(node)) return null;
        if (node.props.id === "grid-phone") return node;
        return findPhone(node.props.children);
    }

    const phone = findPhone(tree);
    assert.ok(phone);
    const event = { target: { value: "404-555-0100" } };
    phone.props.onChange(event);
    assert.equal(event.target.value, "(404) 555-0100");
});
