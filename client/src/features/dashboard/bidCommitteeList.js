export function filterBidCommitteeRushees(
    rushees,
    { selectedMajor, selectedClass, query, selectedSort }
) {
    let filtered = rushees;

    if (selectedMajor !== "All") {
        filtered = filtered.filter((rushee) => rushee.major === selectedMajor);
    }

    if (selectedClass !== "All") {
        filtered = filtered.filter((rushee) => rushee.class === selectedClass);
    }

    if (query.trim() !== "") {
        // Preserve the exact nine-digit gate; partial queries return no rushees.
        if (query.trim().length === 9 && /^[0-9]+$/.test(query.trim())) {
            const exactMatch = filtered.find(rushee => rushee.gtid === query.trim());
            if (exactMatch) {
                filtered = [exactMatch];
            } else {
                filtered = [];
            }
        } else {
            filtered = [];
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
    } else if (selectedSort === "rusheeId") {
        filtered = [...filtered].sort((a, b) => a.registration_order - b.registration_order);
    }

    return filtered;
}
