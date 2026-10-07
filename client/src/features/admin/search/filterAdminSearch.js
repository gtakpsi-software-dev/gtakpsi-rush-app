export function filterRushees(rushees, query) {
    if (query.trim() === "") {
        return [];
    }

    // Keep nonblank queries untrimmed and GTID matching case-sensitive to match the current search.
    const search = query.toLowerCase();
    return rushees.filter((rushee) =>
        rushee.name.toLowerCase().includes(search) || rushee.gtid.includes(search)
    ).slice(0, 10);
}

export function filterBrothers(brothers, query) {
    if (query.trim() === "") {
        return [];
    }

    const search = query.toLowerCase();
    return brothers.filter((brother) => {
        const fullName = `${brother.firstname || brother.firstName || ""} ${brother.lastname || brother.lastName || ""}`.trim();
        return (brother.email || "").toLowerCase().includes(search) || fullName.toLowerCase().includes(search);
    }).slice(0, 10);
}
