export function shuffleArray(array, random = Math.random) {
    return array
        .map((value) => ({ value, sort: random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }) => value);
}

export function filterDashboardRushees(
    rushees,
    { selectedMajor, selectedClass, query, selectedSort },
    fuse
) {
    let filtered = rushees;

    if (selectedMajor !== "All") {
        filtered = filtered.filter((rushee) => rushee.major === selectedMajor);
    }

    if (selectedClass !== "All") {
        filtered = filtered.filter((rushee) => rushee.class === selectedClass);
    }

    if (query.trim() !== "") {
        if (query.trim().length === 9 && /^[0-9]+$/.test(query.trim())) {
            const exactMatch = filtered.find(rushee => rushee.gtid === query.trim());
            filtered = exactMatch ? [exactMatch] : [];
        } else {
            // Fuse searches the full list, matching the current query behavior after filtering.
            const fuzzyResults = fuse.search(query);
            filtered = fuzzyResults.map((result) => result.item);
        }
    }

    if (selectedSort === "firstName") {
        filtered = [...filtered].sort((a, b) => a.name.split(" ")[0].localeCompare(b.name.split(" ")[0]));
    } else if (selectedSort === "lastName") {
        filtered = [...filtered].sort((a, b) => {
            const aLastName = a.name.split(" ").slice(-1)[0];
            const bLastName = b.name.split(" ").slice(-1)[0];
            return aLastName.localeCompare(bLastName);
        });
    }

    return filtered;
}
