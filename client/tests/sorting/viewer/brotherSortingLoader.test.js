import assert from "node:assert/strict";
import test from "node:test";

import { loadBrotherSortingData } from "../../../src/features/sorting/loadBrotherSortingData.js";

function harness({ user = null, response, failure } = {}) {
    const calls = [];
    const state = { columns: null };
    const deps = {
        auth: { currentUser: user },
        apiBase: "/api/brother",
        navigate: (path) => calls.push(["navigate", path]),
        getSorting: async (path) => {
            calls.push(["get", path]);
            if (failure) throw failure;
            return response ?? { data: { status: "success", payload: [] } };
        },
        setColumns: (columns) => { calls.push(["columns"]); state.columns = columns; },
        setLoading: (value) => calls.push(["loading", value]),
        showError: (message) => calls.push(["error", message]),
    };
    return { deps, calls, state };
}

test("missing brother viewer redirects before any request and completes loading", async () => {
    const { deps, calls } = harness();
    await loadBrotherSortingData(deps);
    assert.deepEqual(calls, [["navigate", "/login"], ["loading", false]]);
});

test("brother viewer retains endpoint and grouped sorting rows", async () => {
    const rows = [
        { id: "r1", sortingStatus: "IN_CLOUD", sortingOrder: 2 },
        { id: "r2", sortingStatus: "IN_CLOUD", sortingOrder: 1 },
        { id: "r3", sortingStatus: "unknown", sortingOrder: 3 },
    ];
    const { deps, calls, state } = harness({
        user: { uid: "brother" },
        response: { data: { status: "success", payload: rows } },
    });
    await loadBrotherSortingData(deps);
    assert.deepEqual(calls, [
        ["get", "/api/brother/sorting"], ["columns"], ["loading", false],
    ]);
    assert.deepEqual(state.columns.IN_CLOUD.map((row) => row.id), ["r2", "r1"]);
    assert.deepEqual(state.columns.UNSORTED.map((row) => row.id), ["r3"]);
});

test("failed status and network failure retain the same error and loading state", async () => {
    for (const options of [
        { response: { data: { status: "error" } } },
        { failure: Error("offline") },
    ]) {
        const { deps, calls, state } = harness({ user: { uid: "brother" }, ...options });
        await loadBrotherSortingData(deps);
        assert.deepEqual(calls, [
            ["get", "/api/brother/sorting"],
            ["error", "Failed to load rushees"], ["loading", false],
        ]);
        assert.equal(state.columns, null);
    }
});
