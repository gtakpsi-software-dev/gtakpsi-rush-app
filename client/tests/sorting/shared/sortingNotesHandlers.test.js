import assert from "node:assert/strict";
import test from "node:test";

import { harness, rushee } from "../../helpers/sortingNotesHarness.js";

test("opening notes keeps the request path and success fallbacks", async () => {
    const urls = [];
    const { handlers, calls, state } = harness({
        getNotes: async (url) => { urls.push(url); return { data: { status: "success" } }; },
    });
    await handlers.openNotes(rushee);
    assert.deepEqual(urls, ["/api/admin/rushees/r1/notes"]);
    assert.deepEqual(calls, [
        ["selected", rushee], ["status", "loading"],
        ["notes", ""], ["tags", []], ["status", "idle"],
    ]);
    assert.equal(state.notes, "");
    assert.deepEqual(state.tags, []);
});

test("bid committee notes use the same save behavior with the bidcom endpoint", async () => {
    const requests = [];
    const { handlers, state } = harness({
        apiBase: "/api/bidcom",
        getNotes: async (url) => {
            requests.push(["get", url]);
            return { data: { status: "success", sortingNotes: "Read", sortingTags: ["pis"] } };
        },
        putNotes: async (url, payload) => {
            requests.push(["put", url, payload]);
            return { data: { status: "success" } };
        },
    });
    await handlers.openNotes(rushee);
    await handlers.saveNotes("Updated", ["night_2"]);
    assert.deepEqual(requests, [
        ["get", "/api/bidcom/rushees/r1/notes"],
        ["put", "/api/bidcom/rushees/r1/notes", {
            sortingNotes: "Updated", sortingTags: ["night_2"],
        }],
    ]);
    assert.equal(state.notes, "Read");
    assert.deepEqual(state.tags, ["pis"]);
    assert.deepEqual(state.columns.UNSORTED[0].sortingTags, ["night_2"]);
});

test("opening notes retains saved values and clears them on failed responses or requests", async () => {
    const success = harness({
        getNotes: async () => ({ data: { status: "success", sortingNotes: "Review", sortingTags: ["pis"] } }),
    });
    await success.handlers.openNotes(rushee);
    assert.equal(success.state.notes, "Review");
    assert.deepEqual(success.state.tags, ["pis"]);
    assert.equal(success.state.notesStatus, "idle");

    for (const getNotes of [
        async () => ({ data: { status: "error" } }),
        async () => { throw new Error("offline"); },
    ]) {
        const failed = harness({ getNotes });
        await failed.handlers.openNotes(rushee);
        assert.equal(failed.state.notes, "");
        assert.deepEqual(failed.state.tags, []);
        assert.equal(failed.state.notesStatus, "error");
    }
});

test("closing notes resets state and cancels both pending edits", () => {
    const { handlers, calls, state, notesTimer, tagsTimer } = harness();
    notesTimer.current = { cancelled: false };
    tagsTimer.current = { cancelled: false };
    handlers.closeNotes();
    assert.deepEqual(calls, [
        ["selected", null], ["notes", ""], ["tags", []], ["status", "idle"],
        ["cancel", notesTimer.current], ["cancel", tagsTimer.current],
    ]);
    assert.equal(notesTimer.current.cancelled, true);
    assert.equal(tagsTimer.current.cancelled, true);
    assert.equal(state.selectedRushee, null);
});

test("successful save preserves payload, board tags, status order, and 800 ms reset", async () => {
    const requests = [];
    const { handlers, calls, timers, state } = harness({
        putNotes: async (url, payload) => {
            requests.push([url, payload]);
            return { data: { status: "success" } };
        },
    });
    const updatedTags = ["pis"];
    await handlers.saveNotes("Review", updatedTags);
    assert.deepEqual(requests, [["/api/admin/rushees/r1/notes", {
        sortingNotes: "Review", sortingTags: updatedTags,
    }]]);
    assert.deepEqual(calls.map(([type, value]) => [type, type === "columns" ? null : value]), [
        ["status", "saving"], ["columns", null], ["status", "saved"], ["schedule", 800],
    ]);
    assert.equal(state.columns.UNSORTED[0].sortingTags, updatedTags);
    assert.equal(state.columns.IN_CLOUD[0].sortingTags.length, 0);
    timers[0].callback();
    assert.equal(state.notesStatus, "idle");
});

test("missing selection does nothing and failed saves show error without changing board", async () => {
    const absent = harness({ selectedRushee: null });
    await absent.handlers.saveNotes("Text", []);
    assert.deepEqual(absent.calls, []);

    for (const putNotes of [
        async () => ({ data: { status: "error" } }),
        async () => { throw new Error("offline"); },
    ]) {
        const failed = harness({ putNotes });
        const original = failed.state.columns;
        await failed.handlers.saveNotes("Text", ["pis"]);
        assert.deepEqual(failed.calls, [["status", "saving"], ["status", "error"]]);
        assert.equal(failed.state.columns, original);
        assert.deepEqual(failed.timers, []);
    }
});

test("text edits debounce for 500 ms with the current rendered tags", async () => {
    const requests = [];
    const { handlers, calls, timers, notesTimer, state } = harness({
        putNotes: async (url, payload) => {
            requests.push([url, payload]);
            return { data: { status: "success" } };
        },
    });
    notesTimer.current = { cancelled: false };
    handlers.onNotesChange({ target: { value: "Draft" } });
    assert.deepEqual(calls.slice(0, 3).map(([type]) => type), ["notes", "cancel", "schedule"]);
    assert.equal(notesTimer.current, timers[0]);
    assert.equal(timers[0].delay, 500);
    assert.equal(state.notes, "Draft");
    timers[0].callback();
    await Promise.resolve();
    assert.deepEqual(requests, [["/api/admin/rushees/r1/notes", {
        sortingNotes: "Draft", sortingTags: ["night_1"],
    }]]);
});

test("tag toggles debounce for 300 ms with the current rendered notes", async () => {
    for (const [initialTags, expectedTags] of [
        [["night_1"], []],
        [[], ["night_1"]],
    ]) {
        const requests = [];
        const { handlers, timers, tagsTimer, state } = harness({
            tags: initialTags,
            putNotes: async (url, payload) => {
                requests.push([url, payload]);
                return { data: { status: "success" } };
            },
        });
        tagsTimer.current = { cancelled: false };
        handlers.toggleTag("night_1");
        assert.deepEqual(state.tags, expectedTags);
        assert.equal(tagsTimer.current, timers[0]);
        assert.equal(timers[0].delay, 300);
        timers[0].callback();
        await Promise.resolve();
        assert.deepEqual(requests, [["/api/admin/rushees/r1/notes", {
            sortingNotes: "Existing", sortingTags: expectedTags,
        }]]);
    }
});
