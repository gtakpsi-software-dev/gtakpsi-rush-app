import assert from "node:assert/strict";
import test from "node:test";

import { loadAdminSortingData } from "../../../src/features/sorting/loadAdminSortingData.js";

// Create isolated state, dependency fakes, and captured calls for this test.
function harness({ user = null, allowlist = [], getResponse, getError } = {}) {
    const calls = [];
    const state = { columns: null, loading: true, authChecked: false };
    const deps = {
        auth: { currentUser: user },
        allowlist,
        apiBase: "/api/admin",
        // Record navigate calls for assertions.
        navigate: (path) => calls.push(["navigate", path]),
        // Record sorting lookup and return data or the configured error.
        getSorting: async (path) => {
            calls.push(["get", path]);
            if (getError) throw getError;
            return getResponse || { data: { status: "success", payload: [] } };
        },
        // Record and store the loaded columns.
        setColumns: (columns) => { calls.push(["columns"]); state.columns = columns; },
        // Record and store the loading state.
        setLoading: (value) => { calls.push(["loading", value]); state.loading = value; },
        // Record and store the authentication-check state.
        setAuthChecked: (value) => { calls.push(["checked", value]); state.authChecked = value; },
        // Record show error calls for assertions.
        showError: (message) => calls.push(["error", message]),
    };
    return { deps, state, calls };
}

// Create a user fixture with captured token refreshes.
function makeUser(claims, email = "member@example.com") {
    const calls = [];
    return {
        email,
        calls,
        // Record token refresh and return the configured claims.
        async getIdTokenResult(forceRefresh) {
            calls.push(forceRefresh);
            return { claims };
        },
    };
}

test("missing user redirects without fetching and still ends loading", async () => {
    // Verify missing user redirects without fetching and still ends loading.
    const { deps, calls, state } = harness();
    await loadAdminSortingData(deps);
    assert.deepEqual(calls, [
        ["navigate", "/login"], ["loading", false], ["checked", true],
    ]);
    assert.equal(state.columns, null);
});

test("denied claims and email redirect after a forced token refresh", async () => {
    // Verify denied claims and email redirect after a forced token refresh.
    const user = makeUser({ admin: false }, "member@example.com");
    const { deps, calls } = harness({ user });
    await loadAdminSortingData(deps);
    assert.deepEqual(user.calls, [true]);
    assert.deepEqual(calls, [
        ["navigate", "/login"], ["loading", false], ["checked", true],
    ]);
});

test("admin claims load and group the same sorting rows", async () => {
    // Verify admin claims load and group the same sorting rows.
    const user = makeUser({ admin: true });
    const rows = [
        { id: "r1", sortingStatus: "IN_CLOUD", sortingOrder: 2 },
        { id: "r2", sortingStatus: "IN_CLOUD", sortingOrder: 1 },
        { id: "r3", sortingStatus: "unknown", sortingOrder: 3 },
    ];
    const { deps, calls, state } = harness({
        user, getResponse: { data: { status: "success", payload: rows } },
    });
    await loadAdminSortingData(deps);
    assert.deepEqual(user.calls, [true]);
    assert.deepEqual(calls, [
        ["get", "/api/admin/rushees/sorting"], ["columns"],
        ["loading", false], ["checked", true],
    ]);
    assert.deepEqual(state.columns.IN_CLOUD.map(/* Extract each row ID for ordering assertions. */ (row) => row.id), ["r2", "r1"]);
    assert.deepEqual(state.columns.UNSORTED.map(/* Extract each row ID for ordering assertions. */ (row) => row.id), ["r3"]);
});

test("case-insensitive allowlist grants the same fetch without an admin claim", async () => {
    // Verify case-insensitive allowlist grants the same fetch without an admin claim.
    const user = makeUser({ admin: false }, "MEMBER@EXAMPLE.COM");
    const { deps, calls } = harness({ user, allowlist: ["member@example.com"] });
    await loadAdminSortingData(deps);
    assert.deepEqual(calls.map(/* Return kind to the caller. */ ([kind]) => kind), ["get", "columns", "loading", "checked"]);
});

test("unsuccessful and failed requests report the same error and finish loading", async () => {
    // Verify unsuccessful and failed requests report the same error and finish loading.
    const user = makeUser({ admin: true });
    for (const options of [
        { getResponse: { data: { status: "error" } } },
        { getError: new Error("offline") },
    ]) {
        const { deps, calls, state } = harness({ user, ...options });
        await loadAdminSortingData(deps);
        assert.deepEqual(calls, [
            ["get", "/api/admin/rushees/sorting"],
            ["error", "Failed to load rushees"],
            ["loading", false], ["checked", true],
        ]);
        assert.equal(state.columns, null);
    }
});

test("token refresh failure reports the load error and still records auth completion", async () => {
    // Verify token refresh failure reports the load error and still records auth completion.
    const user = {
        email: "member@example.com",
        // Simulate a dependency failure for this scenario.
        async getIdTokenResult() { throw new Error("token failed"); },
    };
    const { deps, calls } = harness({ user });
    await loadAdminSortingData(deps);
    assert.deepEqual(calls, [
        ["error", "Failed to load rushees"],
        ["loading", false], ["checked", true],
    ]);
});
