import assert from "node:assert/strict";
import test from "node:test";

import { createAddTimeslotActions } from "../../src/features/admin/pis/createAddTimeslotActions.js";

// Create isolated state, dependency fakes, and captured calls for this test.
function setup({ timeslotTime = "2030-01-01T18:00:00Z", response = { status: "success" } } = {}) {
    const calls = [];
    let timeout;
    const { handleAddTimeslot } = createAddTimeslotActions({
        apiBase: "/api/admin",
        timeslotTime,
        timeslotChange: 3,
        // Record set result calls for assertions.
        setResult: (value) => calls.push(["result", value]),
        // Record set is submitting calls for assertions.
        setIsSubmitting: (value) => calls.push(["submitting", value]),
        // Record set timeslot time calls for assertions.
        setTimeslotTime: (value) => calls.push(["time", value]),
        // Record set timeslot change calls for assertions.
        setTimeslotChange: (value) => calls.push(["change", value]),
        // Record set show success calls for assertions.
        setShowSuccess: (value) => calls.push(["success", value]),
        axios: {
            // Record the POST request and return or throw the configured response.
            post: async (url, payload) => {
                calls.push(["post", url, payload]);
                if (response instanceof Error || response?.error) throw response;
                return { data: response };
            },
        },
        // Capture the timeout callback and delay for explicit execution.
        scheduleTimeout: (callback, delay) => {
            calls.push(["timeout", delay]);
            timeout = callback;
        },
    });
    return { calls, handleAddTimeslot, runTimeout: /* Invoke timeout with the test inputs. */ () => timeout() };
}

test("missing time reports validation without starting a request", async () => {
    // Verify missing time reports validation without starting a request.
    const { calls, handleAddTimeslot } = setup({ timeslotTime: "" });
    await handleAddTimeslot();
    assert.deepEqual(calls, [["result", "Please select a time"]]);
});

test("resolved request sends ISO time and resets the form before ending submission", async () => {
    // Verify resolved request sends ISO time and resets the form before ending submission.
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
    // Verify resolved error payload still clears the form and shows success.
    const { calls, handleAddTimeslot } = setup({ response: { status: "error", message: "Full" } });
    await handleAddTimeslot();
    assert.deepEqual(calls.map(/* Return kind to the caller. */ ([kind]) => kind), [
        "submitting", "post", "result", "time", "change", "success", "timeout", "submitting",
    ]);
    assert.deepEqual(calls[2], ["result", JSON.stringify({ status: "error", message: "Full" }, null, 2)]);
});

test("rejected request leaves the form in place and reports server or fallback errors", async () => {
    // Verify rejected request leaves the form in place and reports server or fallback errors.
    for (const [response, message] of [
        [{ error: true, response: { data: "Server rejected" } }, "Server rejected"],
        [new Error("offline"), "An error occurred"],
    ]) {
        const { calls, handleAddTimeslot } = setup({ response });
        await handleAddTimeslot();
        assert.deepEqual(calls.map(/* Return kind to the caller. */ ([kind]) => kind), ["submitting", "post", "result", "submitting"]);
        assert.deepEqual(calls[2], ["result", message]);
    }
});
