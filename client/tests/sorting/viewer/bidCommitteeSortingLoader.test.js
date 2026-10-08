import assert from "node:assert/strict";
import test from "node:test";

import { loadBidCommitteeSortingData } from "../../../src/features/sorting/loadBidCommitteeSortingData.js";

// Create a user fixture with captured token refreshes.
function makeUser(claims, email = "member@example.edu") {
    const refreshes = [];
    return {
        email,
        refreshes,
        // Record token refresh and return the configured claims.
        async getIdTokenResult(forceRefresh) {
            refreshes.push(forceRefresh);
            return { claims };
        },
    };
}

// Create isolated state, dependency fakes, and captured calls for this test.
function harness({ user = null, allowlist = [], response, failure } = {}) {
    const calls = [];
    const state = { columns: null };
    const deps = {
        auth: { currentUser: user },
        allowlist,
        apiBase: "/api/bidcom",
        // Record navigate calls for assertions.
        navigate: (path) => calls.push(["navigate", path]),
        // Record board lookup and return data or the configured error.
        getSorting: async (path) => {
            calls.push(["get", path]);
            if (failure) throw failure;
            return response ?? { data: { status: "success", payload: [] } };
        },
        // Record and store the loaded columns.
        setColumns: (columns) => { calls.push(["columns"]); state.columns = columns; },
        // Record set loading calls for assertions.
        setLoading: (value) => calls.push(["loading", value]),
        // Record set auth checked calls for assertions.
        setAuthChecked: (value) => calls.push(["checked", value]),
        // Record show error calls for assertions.
        showError: (message) => calls.push(["error", message]),
    };
    return { deps, calls, state };
}

test("missing bid-committee viewer redirects and still finishes loading", async () => {
    // Verify missing bid-committee viewer redirects and still finishes loading.
    const { deps, calls } = harness();
    await loadBidCommitteeSortingData(deps);
    assert.deepEqual(calls, [
        ["navigate", "/login"], ["loading", false], ["checked", true],
    ]);
});

test("denied viewer reports access failure before redirecting", async () => {
    // Verify denied viewer reports access failure before redirecting.
    const user = makeUser({ admin: false, bidcom: false });
    const { deps, calls } = harness({ user });
    await loadBidCommitteeSortingData(deps);
    assert.deepEqual(user.refreshes, [true]);
    assert.deepEqual(calls, [
        ["error", "Access denied - Bid Committee or Admin only"],
        ["navigate", "/dashboard"], ["loading", false], ["checked", true],
    ]);
});

test("admin, bidcom, and case-insensitive allowlist each retain board access", async () => {
    // Verify admin, bidcom, and case-insensitive allowlist each retain board access.
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
        await loadBidCommitteeSortingData(deps);

        assert.deepEqual(user.refreshes, [true]);
        assert.deepEqual(calls, [
            ["get", "/api/bidcom/rushees/sorting"], ["columns"],
            ["loading", false], ["checked", true],
        ]);
        assert.deepEqual(state.columns.IN_CLOUD.map(/* Extract each row ID for ordering assertions. */ (row) => row.id), ["r2", "r1"]);
    }
});

test("unsuccessful response, request failure, and token failure keep the load error", async () => {
    // Verify unsuccessful response, request failure, and token failure keep the load error.
    for (const options of [
        { response: { data: { status: "error" } } },
        { failure: new Error("offline") },
    ]) {
        const { deps, calls, state } = harness({ user: makeUser({ bidcom: true }), ...options });
        await loadBidCommitteeSortingData(deps);
        assert.deepEqual(calls, [
            ["get", "/api/bidcom/rushees/sorting"],
            ["error", "Failed to load rushees"],
            ["loading", false], ["checked", true],
        ]);
        assert.equal(state.columns, null);
    }

    const user = { email: "member@example.edu", async getIdTokenResult() {
        // Simulate a dependency failure for this scenario.
         throw Error("token"); } };
    const { deps, calls } = harness({ user });
    await loadBidCommitteeSortingData(deps);
    assert.deepEqual(calls, [
        ["error", "Failed to load rushees"], ["loading", false], ["checked", true],
    ]);
});
