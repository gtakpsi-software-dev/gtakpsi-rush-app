import assert from "node:assert/strict";
import test from "node:test";

import { createAvailabilityEditorActions } from "../../src/features/admin/availability/availabilityEditorActions.js";

const extendedDate = { $date: { $numberLong: "1790784000000" } };
const slotIso = new Date(Number(extendedDate.$date.$numberLong)).toISOString();
const nextIso = "2026-10-01T16:00:00.000Z";
const brother = {
    brother_uid: "uid-1",
    brother_email: "ada@example.com",
    brother_first_name: "Ada",
    brother_last_name: "Example",
    available_timeslots: [extendedDate, nextIso],
};

function setup({ selected = brother, slots = new Set([slotIso]), postResponse = { status: "success" }, getResponse = { status: "success", payload: [brother] }, prefixError = false } = {}) {
    const calls = [];
    const actions = createAvailabilityEditorActions({
        apiBase: "/api/admin",
        getApiPrefix: () => {
            calls.push(["apiPrefix"]);
            if (prefixError) throw new Error("prefix unavailable");
            return "/api";
        },
        editingBrotherAvailability: selected,
        editingSlots: slots,
        allPisTimeslots: [{ time: extendedDate }, { time: { $date: { $numberLong: String(Date.parse(nextIso)) } } }],
        setEditingBrotherAvailability: (value) => calls.push(["selected", value]),
        setEditingSlots: (value) => calls.push(["slots", value]),
        setSavingAvailability: (value) => calls.push(["saving", value]),
        setBrotherAvailabilities: (value) => calls.push(["availabilities", value]),
        axios: {
            post: async (url, payload) => {
                calls.push(["post", url, payload]);
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
    });
    return { calls, actions };
}

test("editor opens both stored date forms and closes with a fresh empty set", () => {
    const { calls, actions } = setup();
    actions.openEditAvailability(brother);
    assert.deepEqual(calls[0], ["selected", brother]);
    assert.deepEqual(calls[1][0], "slots");
    assert.deepEqual([...calls[1][1]], [slotIso, nextIso]);

    actions.closeEditAvailability();
    assert.deepEqual(calls[2], ["selected", null]);
    assert.deepEqual([...calls[3][1]], []);
    assert.notEqual(calls[1][1], calls[3][1]);
});

test("slot toggles and bulk selection retain set semantics", () => {
    const original = new Set([slotIso]);
    const { calls, actions } = setup({ slots: original });
    actions.toggleEditSlot(slotIso);
    assert.deepEqual([...calls[0][1]], []);
    assert.deepEqual([...original], [slotIso]);

    actions.toggleEditSlot(nextIso);
    assert.deepEqual([...calls[1][1]], [slotIso, nextIso]);
    actions.selectAllEditSlots();
    assert.deepEqual([...calls[2][1]], [slotIso, nextIso]);
    actions.clearAllEditSlots();
    assert.deepEqual([...calls[3][1]], []);
});

test("save preserves payload, refresh order, and editor cleanup", async () => {
    const { calls, actions } = setup();
    await actions.saveEditedAvailability();

    assert.deepEqual(calls.map(([kind]) => kind), [
        "saving", "apiPrefix", "post", "success", "get", "availabilities", "selected", "slots", "saving",
    ]);
    assert.deepEqual(calls[2], ["post", "/api/brother/pis-availability/submit", {
        brother_uid: "uid-1",
        brother_email: "ada@example.com",
        brother_first_name: "Ada",
        brother_last_name: "Example",
        available_timeslots: [slotIso],
    }]);
    assert.equal(calls[3][1], "Updated availability for Ada");
    assert.deepEqual(calls[4], ["get", "/api/admin/pis-availability/all"]);
    assert.deepEqual(calls[5], ["availabilities", [brother]]);
    assert.deepEqual(calls.at(-1), ["saving", false]);
});

test("missing selection, rejected saves, and failed refresh keep their original outcomes", async () => {
    const missing = setup({ selected: null });
    await missing.actions.saveEditedAvailability();
    assert.deepEqual(missing.calls, []);

    const rejected = setup({ postResponse: { status: "error", message: "Not allowed" } });
    await rejected.actions.saveEditedAvailability();
    assert.equal(rejected.calls[3][1], "Not allowed");
    assert.ok(!rejected.calls.some(([kind]) => kind === "get" || kind === "selected"));
    assert.deepEqual(rejected.calls.at(-1), ["saving", false]);

    const failedRefresh = setup({ getResponse: new Error("offline") });
    await failedRefresh.actions.saveEditedAvailability();
    assert.equal(failedRefresh.calls[5][1], "Failed to save availability");
    assert.ok(!failedRefresh.calls.some(([kind]) => kind === "selected"));
    assert.deepEqual(failedRefresh.calls.at(-1), ["saving", false]);
});

test("non-success refresh still closes the editor, while prefix failure skips the request", async () => {
    const refreshRejected = setup({ getResponse: { status: "error" } });
    await refreshRejected.actions.saveEditedAvailability();
    assert.deepEqual(refreshRejected.calls.map(([kind]) => kind), [
        "saving", "apiPrefix", "post", "success", "get", "selected", "slots", "saving",
    ]);
    assert.deepEqual(refreshRejected.calls.at(-1), ["saving", false]);

    const missingPrefix = setup({ prefixError: true });
    await missingPrefix.actions.saveEditedAvailability();
    assert.deepEqual(missingPrefix.calls.map(([kind]) => kind), [
        "saving", "apiPrefix", "error", "saving",
    ]);
    assert.equal(missingPrefix.calls[2][1], "Failed to save availability");
    assert.deepEqual(missingPrefix.calls.at(-1), ["saving", false]);
});
