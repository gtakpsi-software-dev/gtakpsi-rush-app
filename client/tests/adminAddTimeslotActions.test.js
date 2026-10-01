import assert from "node:assert/strict";
import test from "node:test";

import { createAddTimeslotActions } from "../src/features/admin/pis/createAddTimeslotActions.js";

function setup({ timeslotTime = "2030-01-01T18:00:00Z", response = { status: "success" } } = {}) {
    const calls = [];
    let timeout;
    const { handleAddTimeslot } = createAddTimeslotActions({
        apiBase: "/api/admin",
        timeslotTime,
        timeslotChange: 3,
        setResult: (value) => calls.push(["result", value]),
        setIsSubmitting: (value) => calls.push(["submitting", value]),
        setTimeslotTime: (value) => calls.push(["time", value]),
        setTimeslotChange: (value) => calls.push(["change", value]),
        setShowSuccess: (value) => calls.push(["success", value]),
        axios: {
            post: async (url, payload) => {
                calls.push(["post", url, payload]);
                if (response instanceof Error || response?.error) throw response;
                return { data: response };
            },
        },
        scheduleTimeout: (callback, delay) => {
            calls.push(["timeout", delay]);
            timeout = callback;
        },
    });
    return { calls, handleAddTimeslot, runTimeout: () => timeout() };
}

test("missing time reports validation without starting a request", async () => {
    const { calls, handleAddTimeslot } = setup({ timeslotTime: "" });
    await handleAddTimeslot();
    assert.deepEqual(calls, [["result", "Please select a time"]]);
});

test("resolved request sends ISO time and resets the form before ending submission", async () => {
    const { calls, handleAddTimeslot, runTimeout } = setup();
    await handleAddTimeslot();
    assert.deepEqual(calls, [
        ["submitting", true],
        ["post", "/api/admin/add_pis_timeslot", { time: "2030-01-01T18:00:00.000Z", change: 3 }],
        ["result", JSON.stringify({ status: "success" }, null, 2)],
        ["time", ""],
        ["change", 1],
        ["success", true],
        ["timeout", 3000],
        ["submitting", false],
    ]);
    runTimeout();
    assert.deepEqual(calls.at(-1), ["success", false]);
});

test("resolved error payload still clears the form and shows success", async () => {
    const { calls, handleAddTimeslot } = setup({ response: { status: "error", message: "Full" } });
    await handleAddTimeslot();
    assert.deepEqual(calls.map(([kind]) => kind), [
        "submitting", "post", "result", "time", "change", "success", "timeout", "submitting",
    ]);
    assert.deepEqual(calls[2], ["result", JSON.stringify({ status: "error", message: "Full" }, null, 2)]);
});

test("rejected request leaves the form in place and reports server or fallback errors", async () => {
    for (const [response, message] of [
        [{ error: true, response: { data: "Server rejected" } }, "Server rejected"],
        [new Error("offline"), "An error occurred"],
    ]) {
        const { calls, handleAddTimeslot } = setup({ response });
        await handleAddTimeslot();
        assert.deepEqual(calls.map(([kind]) => kind), ["submitting", "post", "result", "submitting"]);
        assert.deepEqual(calls[2], ["result", message]);
    }
});
