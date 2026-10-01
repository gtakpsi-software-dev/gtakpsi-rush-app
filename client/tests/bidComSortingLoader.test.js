import assert from "node:assert/strict";
import test from "node:test";

import { loadBidComSortingData } from "../src/features/sorting/loadBidComSortingData.js";

function makeUser(claims, email = "member@example.edu") {
    const refreshes = [];
    return {
        email,
        refreshes,
        async getIdTokenResult(forceRefresh) {
            refreshes.push(forceRefresh);
            return { claims };
        },
    };
}

function harness({ user = null, allowlist = [], response, failure } = {}) {
    const calls = [];
    const state = { columns: null };
    const deps = {
        auth: { currentUser: user },
        allowlist,
        apiBase: "/api/bidcom",
        navigate: (path) => calls.push(["navigate", path]),
        getSorting: async (path) => {
            calls.push(["get", path]);
            if (failure) throw failure;
            return response ?? { data: { status: "success", payload: [] } };
        },
        setColumns: (columns) => { calls.push(["columns"]); state.columns = columns; },
        setLoading: (value) => calls.push(["loading", value]),
        setAuthChecked: (value) => calls.push(["checked", value]),
        showError: (message) => calls.push(["error", message]),
    };
    return { deps, calls, state };
}

test("missing bid-committee viewer redirects and still finishes loading", async () => {
    const { deps, calls } = harness();
    await loadBidComSortingData(deps);
    assert.deepEqual(calls, [
        ["navigate", "/login"], ["loading", false], ["checked", true],
    ]);
});

test("denied viewer reports access failure before redirecting", async () => {
    const user = makeUser({ admin: false, bidcom: false });
    const { deps, calls } = harness({ user });
    await loadBidComSortingData(deps);
    assert.deepEqual(user.refreshes, [true]);
    assert.deepEqual(calls, [
        ["error", "Access denied - Bid Committee or Admin only"],
        ["navigate", "/dashboard"], ["loading", false], ["checked", true],
    ]);
});

test("admin, bidcom, and case-insensitive allowlist each retain board access", async () => {
    for (const [claims, email, allowlist] of [
        [{ admin: true }, "member@example.edu", []],
        [{ bidcom: true }, "member@example.edu", []],
        [{}, "MEMBER@EXAMPLE.EDU", ["member@example.edu"]],
    ]) {
        const user = makeUser(claims, email);
        const rows = [
            { id: "r1", sortingStatus: "IN_CLOUD", sortingOrder: 2 },
            { id: "r2", sortingStatus: "IN_CLOUD", sortingOrder: 1 },
        ];
        const { deps, calls, state } = harness({
            user, allowlist, response: { data: { status: "success", payload: rows } },
        });
        await loadBidComSortingData(deps);

        assert.deepEqual(user.refreshes, [true]);
        assert.deepEqual(calls, [
            ["get", "/api/bidcom/rushees/sorting"], ["columns"],
            ["loading", false], ["checked", true],
        ]);
        assert.deepEqual(state.columns.IN_CLOUD.map((row) => row.id), ["r2", "r1"]);
    }
});

test("unsuccessful response, request failure, and token failure keep the load error", async () => {
    for (const options of [
        { response: { data: { status: "error" } } },
        { failure: new Error("offline") },
    ]) {
        const { deps, calls, state } = harness({ user: makeUser({ bidcom: true }), ...options });
        await loadBidComSortingData(deps);
        assert.deepEqual(calls, [
            ["get", "/api/bidcom/rushees/sorting"],
            ["error", "Failed to load rushees"],
            ["loading", false], ["checked", true],
        ]);
        assert.equal(state.columns, null);
    }

    const user = { email: "member@example.edu", async getIdTokenResult() { throw Error("token"); } };
    const { deps, calls } = harness({ user });
    await loadBidComSortingData(deps);
    assert.deepEqual(calls, [
        ["error", "Failed to load rushees"], ["loading", false], ["checked", true],
    ]);
});
