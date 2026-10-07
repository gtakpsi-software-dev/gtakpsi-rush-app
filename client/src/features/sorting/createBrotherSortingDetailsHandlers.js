export function createBrotherSortingDetailsHandlers({
    apiBase, getNotes, setSelectedRushee, setNotes, setNotesTags,
    setNotesLoading, logger,
}) {
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

    const closeDetails = () => {
        setSelectedRushee(null);
        setNotes("");
        setNotesTags([]);
    };

    return { openDetails, closeDetails };
}
