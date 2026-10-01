import { applySavedSortingTags } from "./applySavedSortingTags.js";

export function createAdminSortingNotesHandlers({
    apiBase, selectedRushee, notes, tags, notesTimer, tagsTimer,
    getNotes, putNotes, setSelectedRushee, setNotes, setTags,
    setNotesStatus, setColumns, schedule = setTimeout, cancel = clearTimeout,
}) {
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

    const saveNotes = async (text, currentTags) => {
        if (!selectedRushee) return;
        setNotesStatus("saving");
        try {
            const resp = await putNotes(`${apiBase}/rushees/${selectedRushee.id}/notes`, {
                sortingNotes: text,
                sortingTags: currentTags,
            });
            if (resp.data.status === "success") {
                setColumns((prev) => applySavedSortingTags(prev, selectedRushee.id, currentTags));
                setNotesStatus("saved");
                schedule(() => setNotesStatus("idle"), 800);
            } else {
                setNotesStatus("error");
            }
        } catch {
            setNotesStatus("error");
        }
    };

    const onNotesChange = (e) => {
        const val = e.target.value;
        setNotes(val);
        if (notesTimer.current) cancel(notesTimer.current);
        // Text and tag edits keep separate timers so each input retains its prior save timing.
        notesTimer.current = schedule(() => {
            saveNotes(val, tags);
        }, 500);
    };

    const toggleTag = (tagKey) => {
        const newTags = tags.includes(tagKey)
            ? tags.filter((tag) => tag !== tagKey)
            : [...tags, tagKey];
        setTags(newTags);
        if (tagsTimer.current) cancel(tagsTimer.current);
        tagsTimer.current = schedule(() => {
            saveNotes(notes, newTags);
        }, 300);
    };

    return { openNotes, closeNotes, saveNotes, onNotesChange, toggleTag };
}
