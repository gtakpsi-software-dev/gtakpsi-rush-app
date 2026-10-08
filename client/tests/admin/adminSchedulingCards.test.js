import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const fixturePath = fileURLToPath(new URL("../fixtures/adminSchedulingCards.json", import.meta.url));
const componentPath = fileURLToPath(new URL("../../src/features/admin/scheduling/AdminSchedulingCards.tsx", import.meta.url));

// Build component props with test-specific overrides.
function props(overrides = {}) {
    return {
        timeslotTime: "",
        // Provide an inert set timeslot time stub for this test.
        setTimeslotTime() {},
        timeslotChange: 1,
        // Provide an inert set timeslot change stub for this test.
        setTimeslotChange() {},
        rushNightName: "",
        // Provide an inert set rush night name stub for this test.
        setRushNightName() {},
        rushNightTime: "",
        // Provide an inert set rush night time stub for this test.
        setRushNightTime() {},
        // Provide an inert handle request stub for this test.
        handleRequest() {},
        ...overrides,
    };
}

// Walk the rendered element tree to collect nodes for assertions.
function collect(node, elements = []) {
    if (Array.isArray(node)) node.forEach(/* Invoke collect with the test inputs. */ (child) => collect(child, elements));
    else if (React.isValidElement(node)) {
        elements.push(node);
        collect(node.props.children, elements);
    }
    return elements;
}

test("PIS timeslot and rush night controls retain original markup", async () => {
    // Verify PIS timeslot and rush night controls retain original markup.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const AdminSchedulingCards = await loadTsxComponent(componentPath);
    const scenarios = {
        empty: {},
        populated: {
            timeslotTime: "2026-10-01T18:00",
            timeslotChange: 3,
            rushNightName: "Meet the Brothers",
            rushNightTime: "2026-10-02T19:00",
        },
    };

    for (const [scenario, values] of Object.entries(scenarios)) {
        const html = renderToStaticMarkup(React.createElement(AdminSchedulingCards, props(values)));
        assert.equal(createHash("sha256").update(html).digest("hex"), expected[scenario], `${scenario} markup changed`);
    }
});

test("scheduling fields and add/delete requests retain values and endpoints", async () => {
    // Verify scheduling fields and add/delete requests retain values and endpoints.
    const AdminSchedulingCards = await loadTsxComponent(componentPath);
    const calls = [];
    const elements = collect(AdminSchedulingCards(props({
        timeslotTime: "2026-10-01T18:00",
        timeslotChange: 3,
        rushNightName: "Meet the Brothers",
        rushNightTime: "2026-10-02T19:00",
        // Record set timeslot time calls for assertions.
        setTimeslotTime: (value) => calls.push(["time", value]),
        // Record set timeslot change calls for assertions.
        setTimeslotChange: (value) => calls.push(["change", value]),
        // Record set rush night name calls for assertions.
        setRushNightName: (value) => calls.push(["name", value]),
        // Record set rush night time calls for assertions.
        setRushNightTime: (value) => calls.push(["nightTime", value]),
        // Record handle request calls for assertions.
        handleRequest: (...args) => calls.push(["request", ...args]),
    })));
    const inputs = elements.filter(/* Identify rendered input elements. */ (element) => element.type === "input");
    const buttons = elements.filter(/* Identify rendered button elements. */ (element) => element.type === "button");

    assert.equal(inputs.length, 4);
    assert.equal(buttons.length, 4);
    inputs[0].props.onChange({ target: { value: "2026-10-03T18:00" } });
    inputs[1].props.onChange({ target: { value: "0" } });
    inputs[2].props.onChange({ target: { value: "Another Night" } });
    inputs[3].props.onChange({ target: { value: "2026-10-04T19:00" } });
    buttons.forEach(/* Invoke button.props.onClick with the test inputs. */ (button) => button.props.onClick());

    assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
        ["time", "2026-10-03T18:00"],
        ["change", 0],
        ["name", "Another Night"],
        ["nightTime", "2026-10-04T19:00"],
        ["request", "add_pis_timeslot", { time: "2026-10-01T18:00", change: 3 }, "post", "Timeslot added!"],
        ["request", "delete_pis_timeslot", { time: "2026-10-01T18:00", change: 3 }, "post", "Timeslot deleted!"],
        ["request", "add-rush-night", { name: "Meet the Brothers", time: "2026-10-02T19:00" }, "post", "Rush night added!"],
        ["request", "delete_rush_night", { time: "2026-10-02T19:00" }, "post", "Rush night deleted!"],
    ]);
});
