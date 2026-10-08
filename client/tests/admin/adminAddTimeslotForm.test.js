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
        // Render a router link as an anchor for markup assertions.
        Link: (props) => {
            const anchorProps = { ...props, href: Reflect.get(props, "to") };
            delete anchorProps.to;
            return React.createElement("a", anchorProps);
        },
    },
    "date-fns": {
        // Return deterministic date and time labels for each format.
        format: (_date, pattern) => pattern === "MMMM d, yyyy" ? "January 1, 2030" : "6:00 PM",
    },
};

// Load form with injected dependencies for isolated tests.
async function loadForm() {
    const TimeslotInputs = await loadTsxComponent(inputsPath, dependencies);
    return loadTsxComponent(componentPath, { ...dependencies, './TimeslotInputs': TimeslotInputs });
}

// Build component props with test-specific overrides.
function props(overrides = {}) {
    return {
        timeslotTime: "",
        // Provide an inert set timeslot time stub for this test.
        setTimeslotTime() {},
        timeslotChange: 1,
        // Provide an inert set timeslot change stub for this test.
        setTimeslotChange() {},
        result: "",
        isSubmitting: false,
        showSuccess: false,
        // Provide an inert handle add timeslot stub for this test.
        handleAddTimeslot() {},
        ...overrides,
    };
}

// Walk the rendered element tree to collect nodes for assertions.
function collect(node, elements = []) {
    if (Array.isArray(node)) {
        node.forEach(/* Invoke collect with the test inputs. */ (child) => collect(child, elements));
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

// Invoke html.replace with the test inputs.
function normalizeClassWhitespace(html) {
    return html.replace(/class="([^"]*)"/g, /* Normalize class spacing before comparing markup. */ (_match, classes) => (
        `class="${classes.replace(/\s+/g, " ").trim()}"`
    ));
}

test("timeslot form retains empty, selected, and submitting markup", async () => {
    // Verify timeslot form retains empty, selected, and submitting markup.
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
    // Verify timeslot form keeps input conversion, submit action, and disabled state.
    const AddTimeslotForm = await loadForm();
    const calls = [];
    const elements = collect(AddTimeslotForm(props({
        timeslotTime: "2030-01-01T18:00",
        timeslotChange: 3,
        isSubmitting: true,
        // Record set timeslot time calls for assertions.
        setTimeslotTime: (value) => calls.push(["time", value]),
        // Record set timeslot change calls for assertions.
        setTimeslotChange: (value) => calls.push(["count", value]),
        // Record handle add timeslot calls for assertions.
        handleAddTimeslot: () => calls.push(["submit"]),
    })));
    const timeInput = elements.find(
        /* Find the input with type datetime-local. */
        (element) => element.type === "input" && element.props.type === "datetime-local");
    const countInput = elements.find(/* Find the input with type number. */ (element) => element.type === "input" && element.props.type === "number");
    const button = elements.find(/* Identify rendered button elements. */ (element) => element.type === "button");

    timeInput.props.onChange({ target: { value: "2030-01-02T19:30" } });
    countInput.props.onChange({ target: { value: "4" } });
    button.props.onClick();

    assert.deepEqual(calls, [["time", "2030-01-02T19:30"], ["count", 4], ["submit"]]);
    assert.equal(button.props.disabled, true);
    assert.match(button.props.className, /opacity-50 cursor-not-allowed/);
});
