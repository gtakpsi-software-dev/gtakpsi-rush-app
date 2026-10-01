import assert from "node:assert/strict";
import test from "node:test";

import { createBrotherSortingDetailsHandlers } from "../src/features/sorting/createBrotherSortingDetailsHandlers.js";

function harness({ response, failure } = {}) {
    const calls = [];
    const handlers = createBrotherSortingDetailsHandlers({
        apiBase: "/api/brother",
        getNotes: async (path) => {
            calls.push(["get", path]);
            if (failure) throw failure;
            return response;
        },
        setSelectedRushee: (value) => calls.push(["selected", value]),
        setNotes: (value) => calls.push(["notes", value]),
        setNotesTags: (value) => calls.push(["tags", value]),
        setNotesLoading: (value) => calls.push(["loading", value]),
        logger: { error: (...args) => calls.push(["error", ...args]) },
    });
    return { calls, handlers };
}

test("opening brother details clears old notes before fetching and shows returned notes", async () => {
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
    const { calls, handlers } = harness({ response: { data: { status: "success" } } });
    await handlers.openDetails({ id: "r2" });
    assert.deepEqual(calls.slice(-3), [["notes", ""], ["tags", []], ["loading", false]]);
});

test("unsuccessful responses leave cleared notes and stop loading", async () => {
    const { calls, handlers } = harness({ response: { data: { status: "error" } } });
    await handlers.openDetails({ id: "r3" });
    assert.deepEqual(calls.map(([name]) => name), [
        "selected", "notes", "tags", "loading", "get", "loading",
    ]);
    assert.deepEqual(calls.at(-1), ["loading", false]);
});

test("request failures preserve the existing error log and loading cleanup", async () => {
    const failure = Error("offline");
    const { calls, handlers } = harness({ failure });
    await handlers.openDetails({ id: "r4" });
    assert.deepEqual(calls.slice(-2), [
        ["error", "Failed to fetch notes", failure], ["loading", false],
    ]);
});

test("closing details clears only the selected rushee, notes, and tags", () => {
    const { calls, handlers } = harness();
    handlers.closeDetails();
    assert.deepEqual(calls, [["selected", null], ["notes", ""], ["tags", []]]);
});
