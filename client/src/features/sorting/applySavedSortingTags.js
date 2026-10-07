export function applySavedSortingTags(prev, rusheeId, tags) {
    const updated = { ...prev };
    Object.keys(updated).forEach((columnKey) => {
        updated[columnKey] = updated[columnKey].map((rushee) =>
            rushee.id === rusheeId ? { ...rushee, sortingTags: tags } : rushee
        );
    });
    return updated;
}
