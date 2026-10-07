import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const fixturePath = fileURLToPath(new URL("../fixtures/addTimeslotForm.json", import.meta.url));
const componentPath = fileURLToPath(new URL("../../src/features/admin/pis/AddTimeslotForm.tsx", import.meta.url));
const inputsPath = fileURLToPath(new URL("../../src/features/admin/pis/TimeslotInputs.tsx", import.meta.url));

const dependencies = {
    "react-router-dom": {
        Link: (props) => {
            const anchorProps = { ...props, href: Reflect.get(props, "to") };
            delete anchorProps.to;
            return React.createElement("a", anchorProps);
        },
    },
    "date-fns": {
        format: (_date, pattern) => pattern === "MMMM d, yyyy" ? "January 1, 2030" : "6:00 PM",
    },
};

async function loadForm() {
    const TimeslotInputs = await loadTsxComponent(inputsPath, dependencies);
    return loadTsxComponent(componentPath, { ...dependencies, './TimeslotInputs': TimeslotInputs });
}

function props(overrides = {}) {
    return {
        timeslotTime: "",
        setTimeslotTime() {},
        timeslotChange: 1,
        setTimeslotChange() {},
        result: "",
        isSubmitting: false,
        showSuccess: false,
        handleAddTimeslot() {},
        ...overrides,
    };
}

function collect(node, elements = []) {
    if (Array.isArray(node)) {
        node.forEach((child) => collect(child, elements));
    } else if (React.isValidElement(node)) {
        elements.push(node);
        if (typeof node.type === 'function') {
            collect(node.type(node.props), elements);
        } else {
            collect(node.props.children, elements);
        }
    }
    return elements;
}

function normalizeClassWhitespace(html) {
    return html.replace(/class="([^"]*)"/g, (_match, classes) => (
        `class="${classes.replace(/\s+/g, " ").trim()}"`
    ));
}

test("timeslot form retains empty, selected, and submitting markup", async () => {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const AddTimeslotForm = await loadForm();
    const scenarios = {
        empty: {},
        selected: { timeslotTime: "2030-01-01T18:00", timeslotChange: 3 },
        submitting: {
            timeslotTime: "2030-01-01T18:00",
            timeslotChange: 3,
            result: "Queued",
            isSubmitting: true,
            showSuccess: true,
        },
    };

    for (const [scenario, values] of Object.entries(scenarios)) {
        const html = renderToStaticMarkup(React.createElement(AddTimeslotForm, props(values)));
        const hash = createHash("sha256").update(normalizeClassWhitespace(html)).digest("hex");
        assert.equal(hash, expected[scenario], `${scenario} markup changed`);
    }
});

test("timeslot form keeps input conversion, submit action, and disabled state", async () => {
    const AddTimeslotForm = await loadForm();
    const calls = [];
    const elements = collect(AddTimeslotForm(props({
        timeslotTime: "2030-01-01T18:00",
        timeslotChange: 3,
        isSubmitting: true,
        setTimeslotTime: (value) => calls.push(["time", value]),
        setTimeslotChange: (value) => calls.push(["count", value]),
        handleAddTimeslot: () => calls.push(["submit"]),
    })));
    const timeInput = elements.find((element) => element.type === "input" && element.props.type === "datetime-local");
    const countInput = elements.find((element) => element.type === "input" && element.props.type === "number");
    const button = elements.find((element) => element.type === "button");

    timeInput.props.onChange({ target: { value: "2030-01-02T19:30" } });
    countInput.props.onChange({ target: { value: "4" } });
    button.props.onClick();

    assert.deepEqual(calls, [["time", "2030-01-02T19:30"], ["count", 4], ["submit"]]);
    assert.equal(button.props.disabled, true);
    assert.match(button.props.className, /opacity-50 cursor-not-allowed/);
});
