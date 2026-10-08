import { applySavedSortingTags } from "./applySavedSortingTags.js";

// Create note-panel loading, saving, and separately debounced text and tag actions.
export function createSortingNotesHandlers({
    apiBase, selectedRushee, notes, tags, notesTimer, tagsTimer,
    getNotes, putNotes, setSelectedRushee, setNotes, setTags,
    setNotesStatus, setColumns, schedule = setTimeout, cancel = clearTimeout,
}) {
    // Open a rushee’s notes and load saved text and tags.
    const openNotes = async (rushee) => {
        setSelectedRushee(rushee);
        setNotesStatus("loading");
        try {
            const resp = await getNotes(`${apiBase}/rushees/${rushee.id}/notes`);
            if (resp.data.status === "success") {
                setNotes(resp.data.sortingNotes || "");
                setTags(resp.data.sortingTags || []);
                setNotesStatus("idle");
            } else {
                setNotes("");
                setTags([]);
                setNotesStatus("error");
            }
        } catch {
            setNotes("");
            setTags([]);
            setNotesStatus("error");
        }
    };

    // Close the notes panel, reset its state, and cancel pending text and tag saves.
    const closeNotes = () => {
        setSelectedRushee(null);
        setNotes("");
        setTags([]);
        setNotesStatus("idle");
        if (notesTimer.current) {
            cancel(notesTimer.current);
        }
        if (tagsTimer.current) {
            cancel(tagsTimer.current);
        }
    };

    // Save notes and tags, update board tags, and report save status.
    const saveNotes = async (text, currentTags) => {
        if (!selectedRushee) return;
        setNotesStatus("saving");
        try {
            const resp = await putNotes(`${apiBase}/rushees/${selectedRushee.id}/notes`, {
                sortingNotes: text,
                sortingTags: currentTags,
            });
            if (resp.data.status === "success") {
                setColumns(/* Apply saved tags to the matching board card. */ (prev) => applySavedSortingTags(prev, selectedRushee.id, currentTags));
                setNotesStatus("saved");
                schedule(/* Return the save indicator to idle after successful feedback. */ () => setNotesStatus("idle"), 800);
            } else {
                setNotesStatus("error");
            }
        } catch {
            setNotesStatus("error");
        }
    };

    // Update note text and debounce its save with the current tags.
    const onNotesChange = (e) => {
        const val = e.target.value;
        setNotes(val);
        if (notesTimer.current) cancel(notesTimer.current);
        // Text and tag edits keep separate timers so each input retains its prior save timing.
        notesTimer.current = schedule(() => {
            // Save the latest edited text after its debounce delay.
            saveNotes(val, tags);
        }, 500);
    };

    // Toggle a tag and debounce saving it with the current notes.
    const toggleTag = (tagKey) => {
        const newTags = tags.includes(tagKey)
            ? tags.filter(/* Remove the toggled tag from the current selection. */ (tag) => tag !== tagKey)
            : [...tags, tagKey];
        setTags(newTags);
        if (tagsTimer.current) cancel(tagsTimer.current);
        tagsTimer.current = schedule(() => {
            // Save the updated tags after their debounce delay.
            saveNotes(notes, newTags);
        }, 300);
    };

    return { openNotes, closeNotes, saveNotes, onNotesChange, toggleTag };
}
