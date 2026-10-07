import { createSortingNotesHandlers } from "../../src/features/sorting/createSortingNotesHandlers.js";

export const rushee = { id: "r1", sortingTags: [] };

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
        getNotes: getNotes || (async () => ({ data: { status: "success" } })),
        putNotes: putNotes || (async () => ({ data: { status: "success" } })),
        setSelectedRushee: (value) => { calls.push(["selected", value]); state.selectedRushee = value; },
        setNotes: (value) => { calls.push(["notes", value]); state.notes = value; },
        setTags: (value) => { calls.push(["tags", value]); state.tags = value; },
        setNotesStatus: (value) => { calls.push(["status", value]); state.notesStatus = value; },
        setColumns: (update) => { calls.push(["columns"]); state.columns = update(state.columns); },
        schedule: (callback, delay) => {
            const timer = { callback, delay, cancelled: false };
            calls.push(["schedule", delay]);
            timers.push(timer);
            return timer;
        },
        cancel: (timer) => { calls.push(["cancel", timer]); timer.cancelled = true; },
    });
    return { handlers, calls, timers, state, notesTimer, tagsTimer };
}

