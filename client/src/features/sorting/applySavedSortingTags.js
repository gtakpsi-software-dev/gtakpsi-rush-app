// Replace one rushee’s saved tags across the board without mutating existing rows.
export function applySavedSortingTags(prev, rusheeId, tags) {
    const updated = { ...prev };
    Object.keys(updated).forEach((columnKey) => {
        // Update matching rows in this column.
        updated[columnKey] = updated[columnKey].map(/* Replace tags only for the matching rushee. */ (rushee) =>
            rushee.id === rusheeId ? { ...rushee, sortingTags: tags } : rushee
        );
    });
    return updated;
}
