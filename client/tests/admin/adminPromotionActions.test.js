import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import test from "node:test";

import { createPromotionActions } from "../../src/features/admin/access/promotionActions.js";

const brother = { uid: "uid-1", id: "fallback", email: "ada@example.com", firstname: "Ada", lastname: "Example" };

function setup({ selectedBrother = brother, statusResponse = { status: "success", admin: true, bidcom: false }, roleResponse = { status: "success" }, failingAdminSetter = false } = {}) {
    const calls = [];
    const actions = createPromotionActions({
        apiBase: "/api/admin",
        selectedBrother,
        setSelectedBrother: (value) => calls.push(["selected", value]),
        setBrotherSearch: (value) => calls.push(["search", value]),
        setFilteredBrothers: (value) => calls.push(["filtered", value]),
        setBrotherAdminStatus: (value) => {
            calls.push(["adminStatus", value]);
            if (failingAdminSetter) throw new Error("setter failed");
        },
        setBrotherBidcomStatus: (value) => calls.push(["bidcomStatus", value]),
        setIsPromoting: (value) => calls.push(["promoting", value]),
        axios: {
            post: async (url, payload) => {
                calls.push(["post", url, payload]);
                const response = url.endsWith("get-admin-status") ? statusResponse : roleResponse;
                if (response instanceof Error) throw response;
                return { data: response };
            },
        },
        toast: {
            success: (message, options) => calls.push(["success", message, options]),
            error: (message, options) => calls.push(["error", message, options]),
        },
    });
    return { calls, actions };
}

test("brother selection preserves display name, UID precedence, and strict role status", async () => {
    const { calls, actions } = setup();
    actions.handleSelectBrother(brother);
    await setImmediate();

    assert.deepEqual(calls.slice(0, 4), [
        ["selected", brother], ["search", "Ada Example"], ["filtered", []],
        ["post", "/api/admin/get-admin-status", { uid: "uid-1" }],
    ]);
    assert.deepEqual(calls.slice(4), [["adminStatus", true], ["bidcomStatus", false]]);

    const fallback = setup({ statusResponse: { status: "success", admin: 1, bidcom: "true" } });
    await fallback.actions.fetchBrotherAdminStatus({ id: "id-2" });
    assert.deepEqual(fallback.calls, [
        ["post", "/api/admin/get-admin-status", { uid: "id-2" }],
        ["adminStatus", false], ["bidcomStatus", false],
    ]);
});

test("missing identity and failed status lookup clear both displayed roles", async () => {
    const missing = setup();
    await missing.actions.fetchBrotherAdminStatus({});
    assert.deepEqual(missing.calls, [["adminStatus", null], ["bidcomStatus", null]]);

    const failed = setup({ statusResponse: new Error("offline") });
    await failed.actions.fetchBrotherAdminStatus(brother);
    assert.deepEqual(failed.calls.slice(1), [["adminStatus", null], ["bidcomStatus", null]]);
});

test("admin and bid committee changes keep payloads, labels, and loading cleanup", async () => {
    const admin = setup();
    await admin.actions.handleSetAdmin(true);
    assert.deepEqual(admin.calls[0], ["promoting", true]);
    assert.deepEqual(admin.calls[1], ["post", "/api/admin/make-admin", { uid: "uid-1", make_admin: true }]);
    assert.deepEqual(admin.calls[2], ["adminStatus", true]);
    assert.equal(admin.calls[3][1], "Granted admin to ada@example.com");
    assert.deepEqual(admin.calls.at(-1), ["promoting", false]);

    const bidcom = setup();
    await bidcom.actions.handleSetBidcom(false);
    assert.deepEqual(bidcom.calls[1], ["post", "/api/admin/make-bidcom", { uid: "uid-1", make_bidcom: false }]);
    assert.deepEqual(bidcom.calls[2], ["bidcomStatus", false]);
    assert.equal(bidcom.calls[3][1], "Removed bid committee access from ada@example.com");
    assert.deepEqual(bidcom.calls.at(-1), ["promoting", false]);
});

test("role gates and failures do not update privileges", async () => {
    const missing = setup({ selectedBrother: null });
    await missing.actions.handleSetAdmin(true);
    assert.deepEqual(missing.calls, [["error", "Select a brother first", undefined]]);

    const noUid = setup({ selectedBrother: { email: "ada@example.com" } });
    await noUid.actions.handleSetBidcom(true);
    assert.deepEqual(noUid.calls, [["error", "No UID found for this brother", undefined]]);

    const denied = setup({ roleResponse: { status: "error", message: "Denied" } });
    await denied.actions.handleSetAdmin(false);
    assert.equal(denied.calls[2][1], "Denied");
    assert.ok(!denied.calls.some(([kind]) => kind === "adminStatus"));
    assert.deepEqual(denied.calls.at(-1), ["promoting", false]);

    const offline = setup({ roleResponse: new Error("offline") });
    await offline.actions.handleSetBidcom(true);
    assert.equal(offline.calls[2][1], "Failed to update bid committee");
    assert.deepEqual(offline.calls.at(-1), ["promoting", false]);
});

test("server-provided and setter errors keep their toasts and loading cleanup", async () => {
    const rejected = new Error("request failed");
    rejected.response = { data: { message: "Claim update denied" } };
    const server = setup({ roleResponse: rejected });
    await server.actions.handleSetAdmin(true);
    assert.equal(server.calls[2][1], "Claim update denied");
    assert.deepEqual(server.calls.at(-1), ["promoting", false]);

    const setter = setup({ failingAdminSetter: true });
    await setter.actions.handleSetAdmin(true);
    assert.deepEqual(setter.calls.map(([kind]) => kind), [
        "promoting", "post", "adminStatus", "error", "promoting",
    ]);
    assert.equal(setter.calls[3][1], "Failed to update admin");
    assert.deepEqual(setter.calls.at(-1), ["promoting", false]);
});
