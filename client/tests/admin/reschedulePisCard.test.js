import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const fixturePath = fileURLToPath(new URL("../fixtures/reschedulePisCard.json", import.meta.url));
const componentPath = fileURLToPath(new URL("../../src/features/admin/pis/ReschedulePisCard.tsx", import.meta.url));
const rushee = { gtid: "900000001", name: "Ada Example" };
const slot = { time: { $date: { $numberLong: "1790784000000" } }, capacity: 2 };
const slotIso = new Date(Number(slot.time.$date.$numberLong)).toISOString();

// Build component props with test-specific overrides.
function props(overrides = {}) {
    return {
        rusheeSearch: "",
        // Provide an inert set rushee search stub for this test.
        setRusheeSearch() {},
        selectedRushee: null,
        // Provide an inert set selected rushee stub for this test.
        setSelectedRushee() {},
        filteredRushees: [],
        // Provide an inert handle select rushee stub for this test.
        handleSelectRushee() {},
        // Return the fixed format current pistime fixture.
        formatCurrentPISTime: () => "Current time",
        selectedNewTimeslot: "",
        // Provide an inert set selected new timeslot stub for this test.
        setSelectedNewTimeslot() {},
        availableTimeslots: [],
        // Return the fixed format timeslot fixture.
        formatTimeslot: () => "New time",
        // Provide an inert handle reschedule pis stub for this test.
        handleReschedulePIS() {},
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

test("PIS reschedule card retains empty, search, and selected markup", async () => {
    // Verify PIS reschedule card retains empty, search, and selected markup.
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    const ReschedulePisCard = await loadTsxComponent(componentPath);
    const scenarios = {
        empty: {},
        search: { rusheeSearch: "Ada", filteredRushees: [rushee], availableTimeslots: [slot] },
        selected: { rusheeSearch: rushee.name, selectedRushee: rushee, selectedNewTimeslot: slotIso, availableTimeslots: [slot] },
    };

    for (const [scenario, values] of Object.entries(scenarios)) {
        const html = renderToStaticMarkup(React.createElement(ReschedulePisCard, props(values)));
        const hash = createHash("sha256").update(html).digest("hex");
        assert.equal(hash, expected[scenario], `${scenario} markup changed`);
    }
});

test("reschedule search, selection, clear, timeslot, and submit handlers stay attached", async () => {
    // Verify reschedule search, selection, clear, timeslot, and submit handlers stay attached.
    const ReschedulePisCard = await loadTsxComponent(componentPath);
    const calls = [];
    const elements = collect(ReschedulePisCard(props({
        rusheeSearch: rushee.name,
        selectedRushee: rushee,
        selectedNewTimeslot: slotIso,
        availableTimeslots: [slot],
        // Record set rushee search calls for assertions.
        setRusheeSearch: (value) => calls.push(["search", value]),
        // Record set selected rushee calls for assertions.
        setSelectedRushee: (value) => calls.push(["selected", value]),
        // Record set selected new timeslot calls for assertions.
        setSelectedNewTimeslot: (value) => calls.push(["timeslot", value]),
        // Record handle reschedule pis calls for assertions.
        handleReschedulePIS: () => calls.push(["submit"]),
    })));
    const search = elements.find(/* Identify rendered input elements. */ (element) => element.type === "input");
    const clear = elements.find(
        /* Identify rendered button elements. */
        (element) => element.type === "button" && element.props.className?.includes("text-apple-gray-400"));
    const select = elements.find(/* Identify rendered select elements. */ (element) => element.type === "select");
    const submit = elements.find(
        /* Find the button with label Reschedule PIS. */
        (element) => element.type === "button" && element.props.children === "Reschedule PIS");

    assert.equal(submit.props.disabled, false);
    search.props.onChange({ target: { value: rushee.name } });
    search.props.onChange({ target: { value: "Other" } });
    clear.props.onClick();
    select.props.onChange({ target: { value: slotIso } });
    submit.props.onClick();
    assert.deepEqual(calls, [
        ["search", rushee.name], ["search", "Other"], ["selected", null],
        ["selected", null], ["search", ""], ["timeslot", slotIso], ["submit"],
    ]);

    const candidates = collect(ReschedulePisCard(props({ filteredRushees: [rushee], handleSelectRushee:
        /* Record handle select rushee calls for assertions. */
        (value) => calls.push(["choose", value]) })));
    const candidate = candidates.find(
        /* Identify elements with the expected styling classes. */
        (element) => element.props.className?.includes("last:border-b-0"));
    candidate.props.onClick();
    assert.equal(calls.at(-1)[1], rushee);
});
