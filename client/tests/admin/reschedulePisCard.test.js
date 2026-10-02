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

function props(overrides = {}) {
    return {
        rusheeSearch: "",
        setRusheeSearch() {},
        selectedRushee: null,
        setSelectedRushee() {},
        filteredRushees: [],
        handleSelectRushee() {},
        formatCurrentPISTime: () => "Current time",
        selectedNewTimeslot: "",
        setSelectedNewTimeslot() {},
        availableTimeslots: [],
        formatTimeslot: () => "New time",
        handleReschedulePIS() {},
        ...overrides,
    };
}

function collect(node, elements = []) {
    if (Array.isArray(node)) {
        node.forEach((child) => collect(child, elements));
    } else if (React.isValidElement(node)) {
        elements.push(node);
        collect(node.props.children, elements);
    }
    return elements;
}

test("PIS reschedule card retains empty, search, and selected markup", async () => {
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
    const ReschedulePisCard = await loadTsxComponent(componentPath);
    const calls = [];
    const elements = collect(ReschedulePisCard(props({
        rusheeSearch: rushee.name,
        selectedRushee: rushee,
        selectedNewTimeslot: slotIso,
        availableTimeslots: [slot],
        setRusheeSearch: (value) => calls.push(["search", value]),
        setSelectedRushee: (value) => calls.push(["selected", value]),
        setSelectedNewTimeslot: (value) => calls.push(["timeslot", value]),
        handleReschedulePIS: () => calls.push(["submit"]),
    })));
    const search = elements.find((element) => element.type === "input");
    const clear = elements.find((element) => element.type === "button" && element.props.className?.includes("text-apple-gray-400"));
    const select = elements.find((element) => element.type === "select");
    const submit = elements.find((element) => element.type === "button" && element.props.children === "Reschedule PIS");

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

    const candidates = collect(ReschedulePisCard(props({ filteredRushees: [rushee], handleSelectRushee: (value) => calls.push(["choose", value]) })));
    const candidate = candidates.find((element) => element.props.className?.includes("last:border-b-0"));
    candidate.props.onClick();
    assert.equal(calls.at(-1)[1], rushee);
});
