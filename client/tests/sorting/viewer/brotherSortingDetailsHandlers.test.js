import assert from "node:assert/strict";
import test from "node:test";

import { createBrotherSortingDetailsHandlers } from "../../../src/features/sorting/createBrotherSortingDetailsHandlers.js";

// Create isolated state, dependency fakes, and captured calls for this test.
function harness({ response, failure } = {}) {
    const calls = [];
    const handlers = createBrotherSortingDetailsHandlers({
        apiBase: "/api/brother",
        // Record details lookup and return data or the configured error.
        getNotes: async (path) => {
            calls.push(["get", path]);
            if (failure) throw failure;
            return response;
        },
        // Record set selected rushee calls for assertions.
        setSelectedRushee: (value) => calls.push(["selected", value]),
        // Record set notes calls for assertions.
        setNotes: (value) => calls.push(["notes", value]),
        // Record set notes tags calls for assertions.
        setNotesTags: (value) => calls.push(["tags", value]),
        // Record set notes loading calls for assertions.
        setNotesLoading: (value) => calls.push(["loading", value]),
        logger: { error: /* Record error calls for assertions. */ (...args) => calls.push(["error", ...args]) },
    });
    return { calls, handlers };
}

test("opening brother details clears old notes before fetching and shows returned notes", async () => {
    // Verify opening brother details clears old notes before fetching and shows returned notes.
    const rushee = { id: "r1" };
    const { calls, handlers } = harness({
        response: { data: { status: "success", sortingNotes: "First", sortingTags: ["night_1"] } },
    });

    await handlers.openDetails(rushee);
    assert.deepEqual(calls, [
        ["selected", rushee], ["notes", ""], ["tags", []], ["loading", true],
        ["get", "/api/brother/rushees/r1/notes"],
        ["notes", "First"], ["tags", ["night_1"]], ["loading", false],
    ]);
});

test("successful responses without notes keep the original empty fallbacks", async () => {
    // Verify successful responses without notes keep the original empty fallbacks.
    const { calls, handlers } = harness({ response: { data: { status: "success" } } });
    await handlers.openDetails({ id: "r2" });
    assert.deepEqual(calls.slice(-3), [["notes", ""], ["tags", []], ["loading", false]]);
});

test("unsuccessful responses leave cleared notes and stop loading", async () => {
    // Verify unsuccessful responses leave cleared notes and stop loading.
    const { calls, handlers } = harness({ response: { data: { status: "error" } } });
    await handlers.openDetails({ id: "r3" });
    assert.deepEqual(calls.map(/* Return name to the caller. */ ([name]) => name), [
        "selected", "notes", "tags", "loading", "get", "loading",
    ]);
    assert.deepEqual(calls.at(-1), ["loading", false]);
});

test("request failures preserve the existing error log and loading cleanup", async () => {
    // Verify request failures preserve the existing error log and loading cleanup.
    const failure = Error("offline");
    const { calls, handlers } = harness({ failure });
    await handlers.openDetails({ id: "r4" });
    assert.deepEqual(calls.slice(-2), [
        ["error", "Failed to fetch notes", failure], ["loading", false],
    ]);
});

test("closing details clears only the selected rushee, notes, and tags", () => {
    // Verify closing details clears only the selected rushee, notes, and tags.
    const { calls, handlers } = harness();
    handlers.closeDetails();
    assert.deepEqual(calls, [["selected", null], ["notes", ""], ["tags", []]]);
});
