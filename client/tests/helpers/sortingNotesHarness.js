import { createSortingNotesHandlers } from "../../src/features/sorting/createSortingNotesHandlers.js";

export const rushee = { id: "r1", sortingTags: [] };

// Create isolated state, dependency fakes, and captured calls for this test.
export function harness({
    apiBase = "/api/admin", selectedRushee = rushee, notes = "Existing",
    tags = ["night_1"], getNotes, putNotes,
} = {}) {
    const calls = [];
    const timers = [];
    const state = {
        selectedRushee, notes, tags, notesStatus: "idle",
        columns: { UNSORTED: [rushee], IN_CLOUD: [{ id: "r2", sortingTags: [] }] },
    };
    const notesTimer = { current: null };
    const tagsTimer = { current: null };
    const handlers = createSortingNotesHandlers({
        apiBase,
        selectedRushee,
        notes,
        tags,
        notesTimer,
        tagsTimer,
        getNotes: getNotes || (/* Return the fixture for this scenario. */ async () => ({ data: { status: "success" } })),
        putNotes: putNotes || (/* Return the fixture for this scenario. */ async () => ({ data: { status: "success" } })),
        // Record selection changes and update the harness state.
        setSelectedRushee: (value) => { calls.push(["selected", value]); state.selectedRushee = value; },
        // Record note changes and update the harness state.
        setNotes: (value) => { calls.push(["notes", value]); state.notes = value; },
        // Record tag changes and update the harness state.
        setTags: (value) => { calls.push(["tags", value]); state.tags = value; },
        // Record save-status changes and update the harness state.
        setNotesStatus: (value) => { calls.push(["status", value]); state.notesStatus = value; },
        // Apply the column updater and record the state change.
        setColumns: (update) => { calls.push(["columns"]); state.columns = update(state.columns); },
        // Capture a cancellable timer and its requested delay.
        schedule: (callback, delay) => {
            const timer = { callback, delay, cancelled: false };
            calls.push(["schedule", delay]);
            timers.push(timer);
            return timer;
        },
        // Record timer cancellation and mark the handle cancelled.
        cancel: (timer) => { calls.push(["cancel", timer]); timer.cancelled = true; },
    });
    return { handlers, calls, timers, state, notesTimer, tagsTimer };
}

