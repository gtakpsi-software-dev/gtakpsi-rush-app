// Return a shuffled copy by sorting items with randomly assigned keys.
export function shuffleArray(array, random = Math.random) {
    return array
        .map(/* Assign a random sort key to the item. */ (value) => ({ value, sort: random() }))
        .sort(/* Compare the randomly assigned sort keys. */ (a, b) => a.sort - b.sort)
        .map(/* Extract the original item after sorting. */ ({ value }) => value);
}

// Filter and sort rushees; fuzzy searches use the full Fuse dataset.
export function filterDashboardRushees(
    rushees,
    { selectedMajor, selectedClass, query, selectedSort },
    fuse
) {
    let filtered = rushees;

    if (selectedMajor !== "All") {
        filtered = filtered.filter(/* Keep rushees with the selected major. */ (rushee) => rushee.major === selectedMajor);
    }

    if (selectedClass !== "All") {
        filtered = filtered.filter(/* Keep rushees with the selected class year. */ (rushee) => rushee.class === selectedClass);
    }

    if (query.trim() !== "") {
        if (query.trim().length === 9 && /^[0-9]+$/.test(query.trim())) {
            const exactMatch = filtered.find(/* Match the trimmed nine-digit GTID exactly. */ rushee => rushee.gtid === query.trim());
            filtered = exactMatch ? [exactMatch] : [];
        } else {
            // Fuse searches the full list, matching the current query behavior after filtering.
            const fuzzyResults = fuse.search(query);
            filtered = fuzzyResults.map(/* Extract the rushee from a Fuse search result. */ (result) => result.item);
        }
    }

    if (selectedSort === "firstName") {
        filtered = [...filtered].sort(
            /* Compare the first word of each name alphabetically. */
            (a, b) => a.name.split(" ")[0].localeCompare(b.name.split(" ")[0]));
    } else if (selectedSort === "lastName") {
        filtered = [...filtered].sort((a, b) => {
            // Compare the final word of each name alphabetically.
            const aLastName = a.name.split(" ").slice(-1)[0];
            const bLastName = b.name.split(" ").slice(-1)[0];
            return aLastName.localeCompare(bLastName);
        });
    }

    return filtered;
}
