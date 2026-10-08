// Create read-only detail-panel actions for a selected rushee’s sorting notes.
export function createBrotherSortingDetailsHandlers({
    apiBase, getNotes, setSelectedRushee, setNotes, setNotesTags,
    setNotesLoading, logger,
}) {
    // Open a rushee’s details, clear stale content, and fetch current notes and tags.
    const openDetails = async (rushee) => {
        setSelectedRushee(rushee);
        // Clear the previous rushee's notes before the new request settles.
        setNotes("");
        setNotesTags([]);
        setNotesLoading(true);

        try {
            const response = await getNotes(`${apiBase}/rushees/${rushee.id}/notes`);
            if (response.data.status === "success") {
                setNotes(response.data.sortingNotes || "");
                setNotesTags(response.data.sortingTags || []);
            }
        } catch (error) {
            logger.error("Failed to fetch notes", error);
        } finally {
            setNotesLoading(false);
        }
    };

    // Close the detail panel and clear notes and tags.
    const closeDetails = () => {
        setSelectedRushee(null);
        setNotes("");
        setNotesTags([]);
    };

    return { openDetails, closeDetails };
}
