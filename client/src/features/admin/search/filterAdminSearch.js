// Return up to ten name or GTID matches, or no results for a blank query.
export function filterRushees(rushees, query) {
    if (query.trim() === "") {
        return [];
    }

    // Keep nonblank queries untrimmed and GTID matching case-sensitive to match the current search.
    const search = query.toLowerCase();
    return rushees.filter(/* Match the search text against a rushee’s name or GTID. */ (rushee) =>
        rushee.name.toLowerCase().includes(search) || rushee.gtid.includes(search)
    ).slice(0, 10);
}

// Return up to ten brother email or full-name matches.
export function filterBrothers(brothers, query) {
    if (query.trim() === "") {
        return [];
    }

    const search = query.toLowerCase();
    return brothers.filter((brother) => {
        // Match the query against the brother’s email or normalized full name.
        const fullName = `${brother.firstname || brother.firstName || ""} ${brother.lastname || brother.lastName || ""}`.trim();
        return (brother.email || "").toLowerCase().includes(search) || fullName.toLowerCase().includes(search);
    }).slice(0, 10);
}
