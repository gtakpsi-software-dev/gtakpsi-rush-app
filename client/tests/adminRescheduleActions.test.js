import assert from "node:assert/strict";
import test from "node:test";

import { createRescheduleActions } from "../src/features/admin/pis/rescheduleActions.js";

const rushee = { gtid: "900000001", name: "Ada Example" };

function setup({ selectedRushee = rushee, selectedNewTimeslot = "2026-10-01T16:00:00.000Z", postResponse = { status: "success" }, getResponse = { status: "success", payload: ["available"] } } = {}) {
    const calls = [];
    const actions = createRescheduleActions({
        rusheeApiBase: "/api/rushee",
        selectedRushee,
        selectedNewTimeslot,
        setSelectedRushee: (value) => calls.push(["selected", value]),
        setRusheeSearch: (value) => calls.push(["search", value]),
        setFilteredRushees: (value) => calls.push(["filtered", value]),
        setSelectedNewTimeslot: (value) => calls.push(["timeslot", value]),
        setAvailableTimeslots: (value) => calls.push(["available", value]),
        axios: {
            post: async (url, body, options) => {
                calls.push(["post", url, body, options]);
                if (postResponse instanceof Error) throw postResponse;
                return { data: postResponse };
            },
            get: async (url) => {
                calls.push(["get", url]);
                if (getResponse instanceof Error) throw getResponse;
                return { data: getResponse };
            },
        },
        toast: {
            success: (message, options) => calls.push(["success", message, options]),
            error: (message, options) => calls.push(["error", message, options]),
        },
        logError: (message, error) => calls.push(["log", message, error.message]),
    });
    return { calls, actions };
}

test("selecting a rushee retains the search label and clears suggestions", () => {
    const { calls, actions } = setup();
    actions.handleSelectRushee(rushee);
    assert.deepEqual(calls, [["selected", rushee], ["search", "Ada Example"], ["filtered", []]]);
});

test("rescheduling preserves the encoded request and refresh order", async () => {
    const { calls, actions } = setup();
    await actions.handleReschedulePIS();

    assert.deepEqual(calls[0], ["post", "/api/rushee/reschedule-pis/900000001", '"2026-10-01T16:00:00.000Z"', {
        headers: { "Content-Type": "application/json" },
    }]);
    assert.deepEqual(calls.map(([kind]) => kind), [
        "post", "success", "selected", "search", "timeslot", "get", "available",
    ]);
    assert.equal(calls[1][1], "PIS rescheduled for Ada Example");
    assert.deepEqual(calls[5], ["get", "/api/rushee/get-available-timeslots"]);
    assert.deepEqual(calls[6], ["available", ["available"]]);
});

test("missing selection and failed submissions keep state unchanged", async () => {
    const missing = setup({ selectedNewTimeslot: "" });
    await missing.actions.handleReschedulePIS();
    assert.equal(missing.calls.length, 1);
    assert.equal(missing.calls[0][1], "Please select a rushee and a new timeslot");

    const denied = setup({ postResponse: { status: "error", message: "No capacity" } });
    await denied.actions.handleReschedulePIS();
    assert.equal(denied.calls[1][1], "No capacity");
    assert.ok(!denied.calls.some(([kind]) => kind === "selected" || kind === "get"));

    const offline = setup({ postResponse: new Error("offline") });
    await offline.actions.handleReschedulePIS();
    assert.equal(offline.calls[1][1], "An error occurred");
});

test("failed refresh leaves the successful reschedule and cleared selection intact", async () => {
    const { calls, actions } = setup({ getResponse: new Error("offline") });
    await actions.handleReschedulePIS();
    assert.deepEqual(calls.map(([kind]) => kind), ["post", "success", "selected", "search", "timeslot", "get", "log"]);
    assert.deepEqual(calls.at(-1), ["log", "Failed to refresh timeslots:", "offline"]);
});
