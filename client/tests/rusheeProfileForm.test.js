import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "./helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../src/features/rushee/self/RusheeProfileForm.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("./fixtures/rusheeProfileForm.json", import.meta.url));
const rushee = {
    first_name: "Ada", last_name: "One", housing: "Hall",
    phone_number: "(404) 555-1234", email: "ada@example.com", gtid: "123456789",
    major: "Computer Science", class: "Third", pronouns: "she/her",
};

function collect(node, elements = []) {
    if (Array.isArray(node)) {
        node.forEach((child) => collect(child, elements));
    } else if (React.isValidElement(node)) {
        elements.push(node);
        collect(node.props.children, elements);
    }
    return elements;
}

test("self-profile form retains its pre-extraction fields, labels, options, and styling", async () => {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const RusheeProfileForm = await loadTsxComponent(componentPath);
    const html = renderToStaticMarkup(React.createElement(RusheeProfileForm, {
        rushee, onSubmit() {}, onChange() {},
    }));
    assert.equal(createHash("sha256").update(html).digest("hex"), expected.filled);
});

test("form keeps the original submit and regular field handlers", async () => {
    const RusheeProfileForm = await loadTsxComponent(componentPath);
    const calls = [];
    const onSubmit = (event) => calls.push(["submit", event]);
    const onChange = (event) => calls.push(["change", event]);
    const nodes = collect(RusheeProfileForm({ rushee, onSubmit, onChange }));
    const form = nodes.find((node) => node.type === "form");
    const firstName = nodes.find((node) => node.type === "input" && node.props.name === "first_name");
    assert.equal(form.props.onSubmit, onSubmit);
    assert.equal(firstName.props.value, "Ada");
    assert.equal(firstName.props.onChange, onChange);
    const event = { target: { name: "first_name", value: "Adaline" } };
    firstName.props.onChange(event);
    form.props.onSubmit(event);
    assert.deepEqual(calls, [["change", event], ["submit", event]]);
});

test("phone input mutates the event with the existing partial and full formats", async () => {
    const RusheeProfileForm = await loadTsxComponent(componentPath);
    const calls = [];
    const nodes = collect(RusheeProfileForm({
        rushee, onSubmit() {}, onChange: (event) => calls.push(event),
    }));
    const phone = nodes.find((node) => node.type === "input" && node.props.name === "phone_number");
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
