import assert from "node:assert/strict";
import test from "node:test";

import { createAvailabilityFormActions } from "../src/features/admin/availability/availabilityFormActions.js";

function setup(response = { status: "success" }, confirmed = true, failingStatusSetter = false) {
    const calls = [];
    const actions = createAvailabilityFormActions({
        apiBase: "/api/admin",
        pisFormStatus: { is_active: true, sent_at: "previous" },
        setPisFormStatus: (value) => {
            calls.push(["status", value]);
            if (failingStatusSetter) throw new Error("setter failed");
        },
        setPisFormLoading: (value) => calls.push(["loading", value]),
        setBrotherAvailabilities: (value) => calls.push(["availabilities", value]),
        axios: {
            post: async (url) => {
                calls.push(["post", url]);
                if (response instanceof Error) throw response;
                return { data: response };
            },
        },
        toast: {
            success: (message, options) => calls.push(["success", message, options]),
            error: (message, options) => calls.push(["error", message, options]),
        },
        confirm: (message) => {
            calls.push(["confirm", message]);
            return confirmed;
        },
    });
    return { calls, actions };
}

test("sending and deactivating the form keep request order, state, and toasts", async () => {
    const sent = setup();
    await sent.actions.handleSendPISForm();
    assert.deepEqual(sent.calls.map(([kind]) => kind), ["loading", "post", "status", "success", "loading"]);
    assert.deepEqual(sent.calls[1], ["post", "/api/admin/pis-availability/send-form"]);
    assert.equal(sent.calls[2][1].is_active, true);
    assert.ok(!Number.isNaN(Date.parse(sent.calls[2][1].sent_at)));
    assert.equal(sent.calls[3][1], "PIS availability form sent to all brothers!");
    assert.deepEqual(sent.calls.at(-1), ["loading", false]);

    const deactivated = setup();
    await deactivated.actions.handleDeactivatePISForm();
    assert.deepEqual(deactivated.calls[1], ["post", "/api/admin/pis-availability/deactivate"]);
    assert.deepEqual(deactivated.calls[2], ["status", { is_active: false, sent_at: "previous" }]);
    assert.equal(deactivated.calls[3][1], "Form deactivated");
});

test("clear and resend requires confirmation and clears submissions only on success", async () => {
    const cancelled = setup(undefined, false);
    await cancelled.actions.handleClearAndResendPISForm();
    assert.equal(cancelled.calls.length, 1);
    assert.match(cancelled.calls[0][1], /clear all existing brother availability submissions/);

    const accepted = setup();
    await accepted.actions.handleClearAndResendPISForm();
    assert.deepEqual(accepted.calls.map(([kind]) => kind), [
        "confirm", "loading", "post", "status", "availabilities", "success", "loading",
    ]);
    assert.deepEqual(accepted.calls[2], ["post", "/api/admin/pis-availability/clear-and-resend"]);
    assert.deepEqual(accepted.calls[4], ["availabilities", []]);
});

test("assignment actions retain confirmation, endpoints, and response messages", async () => {
    const assigned = setup({ status: "success", message: "Assigned two brothers" });
    await assigned.actions.handleAutoAssignBrothers();
    assert.match(assigned.calls[0][1], /automatically assign available brothers/);
    assert.deepEqual(assigned.calls[2], ["post", "/api/admin/pis-availability/auto-assign"]);
    assert.equal(assigned.calls[3][1], "Assigned two brothers");
    assert.equal(assigned.calls[3][2].autoClose, 5000);
    assert.deepEqual(assigned.calls.at(-1), ["loading", false]);

    const cleared = setup({ status: "error", message: "Cannot clear" });
    await cleared.actions.handleClearAssignments();
    assert.deepEqual(cleared.calls[2], ["post", "/api/admin/pis-availability/clear-assignments"]);
    assert.deepEqual(cleared.calls[3].slice(0, 2), ["error", "Cannot clear"]);
    assert.deepEqual(cleared.calls.at(-1), ["loading", false]);
});

test("clearing assignments stops before state or network work when cancelled", async () => {
    const cancelled = setup(undefined, false);
    await cancelled.actions.handleClearAssignments();
    assert.deepEqual(cancelled.calls.map(([kind]) => kind), ["confirm"]);
    assert.match(cancelled.calls[0][1], /clear all brother assignments from PIS slots/);
});

test("request failures keep each action's fallback and clear loading", async () => {
    const sent = setup(new Error("offline"));
    await sent.actions.handleSendPISForm();
    assert.equal(sent.calls[2][1], "Failed to send form");
    assert.deepEqual(sent.calls.at(-1), ["loading", false]);

    const assigned = setup(new Error("offline"));
    await assigned.actions.handleAutoAssignBrothers();
    assert.equal(assigned.calls[3][1], "Failed to auto-assign brothers");
    assert.deepEqual(assigned.calls.at(-1), ["loading", false]);
});

test("assignment responses keep distinct fallbacks and success timeouts", async () => {
    const rejected = setup({ status: "error" });
    await rejected.actions.handleAutoAssignBrothers();
    assert.equal(rejected.calls[3][1], "Failed to auto-assign");
    assert.equal(rejected.calls[3][2].autoClose, 3000);
    assert.deepEqual(rejected.calls.at(-1), ["loading", false]);

    const cleared = setup({ status: "success", message: "Assignments cleared" });
    await cleared.actions.handleClearAssignments();
    assert.equal(cleared.calls[3][1], "Assignments cleared");
    assert.equal(cleared.calls[3][2].autoClose, 3000);
    assert.deepEqual(cleared.calls.at(-1), ["loading", false]);

    const offline = setup(new Error("offline"));
    await offline.actions.handleClearAssignments();
    assert.equal(offline.calls[3][1], "Failed to clear assignments");
    assert.deepEqual(offline.calls.at(-1), ["loading", false]);
});

test("form failures preserve silent deactivation and caught state-update errors", async () => {
    const unsent = setup({ status: "error" });
    await unsent.actions.handleSendPISForm();
    assert.deepEqual(unsent.calls.map(([kind]) => kind), ["loading", "post", "error", "loading"]);
    assert.equal(unsent.calls[2][1], "Failed to send form");

    const inactive = setup({ status: "error", message: "Denied" });
    await inactive.actions.handleDeactivatePISForm();
    assert.deepEqual(inactive.calls.map(([kind]) => kind), ["loading", "post", "loading"]);

    const failedClear = setup({ status: "success" }, true, true);
    await failedClear.actions.handleClearAndResendPISForm();
    assert.deepEqual(failedClear.calls.map(([kind]) => kind), [
        "confirm", "loading", "post", "status", "error", "loading",
    ]);
    assert.equal(failedClear.calls[4][1], "Failed to clear and resend");
});
