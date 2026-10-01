import assert from "node:assert/strict";
import test from "node:test";

import { submitBrotherPisSlot } from "../src/features/brotherPis/submitBrotherPisSlot.js";

function harness(overrides = {}) {
    const calls = [];
    const dependencies = {
        selectedSlot: "Tue Jan 1zz2030-01-01T18:00:00.000Zzz900000001",
        user: { firstname: "Ada", lastname: "Lovelace", firstName: "ignored" },
        axios: {
            post: async (url, payload) => {
                calls.push(["post", url, payload]);
                return { data: { status: "success" } };
            },
        },
        api: "/api",
        toast: { error: (...args) => calls.push(["toast", ...args]) },
        alert: message => calls.push(["alert", message]),
        reload: () => calls.push(["reload"]),
        logError: (...args) => calls.push(["log", ...args]),
        ...overrides,
    };
    return { calls, dependencies };
}

test("missing selection sends no request", async () => {
    const { calls, dependencies } = harness({ selectedSlot: null });
    await submitBrotherPisSlot(dependencies);
    assert.deepEqual(calls, []);
});

test("successful signup uses stored lowercase names, GTID, alert, and reload order", async () => {
    const { calls, dependencies } = harness();
    await submitBrotherPisSlot(dependencies);
    assert.deepEqual(calls, [
        ["post", "/api/admin/pis-signup/900000001", {
            brother_first_name: "Ada", brother_last_name: "Lovelace",
        }],
        ["alert", "YOU successfully signed up for PIS timeslot! Great Work!"],
        ["reload"],
    ]);
});

test("server error uses its message and the original toast options", async () => {
    const { calls, dependencies } = harness({
        axios: { post: async () => ({ data: { status: "error", message: "Full slot" } }) },
    });
    await submitBrotherPisSlot(dependencies);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], "toast");
    assert.equal(calls[0][1], "Full slot");
    assert.deepEqual(calls[0][2], {
        position: "top-center", autoClose: 5000, hideProgressBar: false,
        closeOnClick: true, pauseOnHover: true, draggable: true,
        progress: undefined, theme: "dark",
        style: { fontSize: "18px", padding: "20px", minHeight: "80px" },
    });
});

test("request failure logs the error before showing the generic toast", async () => {
    const failure = new Error("offline");
    const { calls, dependencies } = harness({
        axios: { post: async () => { throw failure; } },
    });
    await submitBrotherPisSlot(dependencies);
    assert.deepEqual(calls[0], ["log", "Error submitting selected slot:", failure]);
    assert.equal(calls[1][0], "toast");
    assert.equal(calls[1][1], "An error occurred while submitting the timeslot. Please try again.");
    assert.equal(calls[1][2].autoClose, 5000);
    assert.equal(calls.length, 2);
});
