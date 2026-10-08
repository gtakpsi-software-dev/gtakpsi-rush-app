import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const componentPath = fileURLToPath(new URL("../../src/features/pis/PisBrotherFields.tsx", import.meta.url));
const fixturePath = fileURLToPath(new URL("../fixtures/pisBrotherFields.json", import.meta.url));
// Render a lightweight React element for component assertions.
const CollaborativeInput = () => React.createElement("input", { "data-stub": "collaborative" });
const signup = {
    first_brother_first_name: "Ari", first_brother_last_name: "One",
    second_brother_first_name: "Bea", second_brother_last_name: "Two",
};
const collaboration = { isConnected: true };
const currentUser = { id: "u1" };

// Build component props with test-specific overrides.
function props(overrides = {}) {
    return {
        rushee: { pis_signup: signup },
        brotherA: { firstName: "Al", lastName: "A" },
        brotherB: { firstName: "Bo", lastName: "B" },
        collaboration,
        currentUser,
        // Provide an inert handle brother achange stub for this test.
        handleBrotherAChange() {},
        // Provide an inert handle brother bchange stub for this test.
        handleBrotherBChange() {},
        ...overrides,
    };
}

// Walk the rendered element tree to collect nodes for assertions.
function collect(node, elements = []) {
    if (Array.isArray(node)) {
        node.forEach(/* Invoke collect with the test inputs. */ (child) => collect(child, elements));
    } else if (React.isValidElement(node)) {
        elements.push(node);
        collect(node.props.children, elements);
    }
    return elements;
}

test("brother fields retain assignment display for all original sentinel states", async () => {
    // Verify brother fields retain assignment display for all original sentinel states.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const PisBrotherFields = await loadTsxComponent(componentPath, {
        "../collaboration/CollaborativeInput": CollaborativeInput,
    });
    const cases = {
        assigned: signup,
        firstOnly: { ...signup, second_brother_first_name: "none" },
        unassigned: { ...signup, first_brother_first_name: "none", second_brother_first_name: "none" },
        noSignup: null,
    };
    for (const [name, pis_signup] of Object.entries(cases)) {
        const html = renderToStaticMarkup(React.createElement(PisBrotherFields, props({
            rushee: { pis_signup },
        })));
        assert.equal(createHash("sha256").update(html).digest("hex"), expected[name]);
    }
});

test("four collaborative fields keep their keys, required flags, and update routes", async () => {
    // Verify four collaborative fields keep their keys, required flags, and update routes.
    const PisBrotherFields = await loadTsxComponent(componentPath, {
        "../collaboration/CollaborativeInput": CollaborativeInput,
    });
    const calls = [];
    const tree = PisBrotherFields(props({
        // Record handle brother achange calls for assertions.
        handleBrotherAChange: (field, value) => calls.push(["A", field, value]),
        // Record handle brother bchange calls for assertions.
        handleBrotherBChange: (field, value) => calls.push(["B", field, value]),
    }));
    const inputs = collect(tree).filter(/* Match node.type to CollaborativeInput. */ (node) => node.type === CollaborativeInput);
    assert.deepEqual(inputs.map(/* Return the fixture for this scenario. */ ({ props: input }) => [
        input.fieldKey, input.value, Boolean(input.required), input.placeholder,
    ]), [
        ["_brotherA_firstName", "Al", true, "First Name"],
        ["_brotherA_lastName", "A", true, "Last Name"],
        ["_brotherB_firstName", "Bo", false, "First Name"],
        ["_brotherB_lastName", "B", false, "Last Name"],
    ]);
    for (const input of inputs) {
        assert.equal(input.props.collaboration, collaboration);
        assert.equal(input.props.currentUser, currentUser);
    }
    inputs.forEach(/* Invoke input.props.onChange with the test inputs. */ (input, index) => input.props.onChange(`value-${index}`));
    assert.deepEqual(calls, [
        ["A", "firstName", "value-0"], ["A", "lastName", "value-1"],
        ["B", "firstName", "value-2"], ["B", "lastName", "value-3"],
    ]);
});
