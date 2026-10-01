import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";
import { formatPhoneInput } from "../src/lib/formatPhoneInput.js";
import { MAJOR_OPTIONS } from "../src/data/majorOptions.js";
import { PRONOUN_OPTIONS, YEAR_OPTIONS } from "../src/data/profileOptions.js";
import { EXPOSURE_OPTIONS } from "../src/features/registration/basicInfoOptions.js";

const componentPath = fileURLToPath(new URL("../src/features/registration/BasicInfoForm.tsx", import.meta.url));
const fieldsPath = fileURLToPath(new URL("../src/features/registration/BasicInfoFields.tsx", import.meta.url));
const contactPath = fileURLToPath(new URL("../src/features/registration/BasicContactFields.tsx", import.meta.url));
const expectedHash = "ea94be2a5ee2dd4436a9e19eed43d9388e04c88f6121dcf7d0d3a7df57f4fafd";

test("basic information form keeps its original labels, fields, options, and markup", async () => {
    const BasicContactFields = await loadTsxComponent(contactPath, {
        "../../lib/formatPhoneInput.js": { formatPhoneInput },
    });
    const BasicInfoFields = await loadTsxComponent(fieldsPath, {
        "./BasicContactFields": BasicContactFields,
        "../../data/majorOptions.js": { MAJOR_OPTIONS },
        "../../data/profileOptions.js": { PRONOUN_OPTIONS, YEAR_OPTIONS },
        "./basicInfoOptions.js": { EXPOSURE_OPTIONS },
    });
    const BasicInfoForm = await loadTsxComponent(componentPath, {
        "./BasicInfoFields": BasicInfoFields,
    });
    const refs = Object.fromEntries([
        "firstname", "lastname", "email", "housing", "phone",
        "gtid", "major", "pronouns", "year", "exposure",
    ].map((name) => [name, { current: null }]));
    const onContinue = () => {};
    const html = renderToStaticMarkup(React.createElement(BasicInfoForm, {
        ...refs,
        onContinue,
    }));

    assert.equal(createHash("sha256").update(html).digest("hex"), expectedHash);

    const findButton = (node) => {
        if (Array.isArray(node)) return node.map(findButton).find(Boolean);
        if (!React.isValidElement(node)) return null;
        if (node.type === "button") return node;
        return findButton(node.props.children);
    };
    const button = findButton(BasicInfoForm({ ...refs, onContinue }));
    assert.equal(button.props.onClick, onContinue);
});
