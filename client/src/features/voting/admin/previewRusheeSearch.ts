import type { Rushee } from "./types";

type PreviewRushee = Rushee & {
    firstname?: string;
    lastname?: string;
    name?: string;
};

// Filter selectable rushees by name or GTID, retaining the full list for blank queries.
export function filterPreviewRushees(allRushees: Rushee[] | null, searchQuery: string) {
    if (!allRushees || !searchQuery.trim()) return allRushees;

    const query = searchQuery.toLowerCase();
    return allRushees.filter((rushee) => {
        // Match current or legacy name fields and GTID against the search text.
        const legacy = rushee as PreviewRushee;
        const firstName = rushee.first_name || legacy.firstname || "";
        const lastName = rushee.last_name || legacy.lastname || "";
        const fullName = `${firstName} ${lastName}`.toLowerCase().trim();
        const singleName = legacy.name?.toLowerCase() || "";
        const gtid = (rushee.gtid || "").toLowerCase();

        return fullName.includes(query) || singleName.includes(query) || gtid.includes(query);
    });
}

// Choose a display name from current or legacy fields, falling back to Unknown Name.
export function previewRusheeName(rushee: Rushee) {
    const legacy = rushee as PreviewRushee;
    return rushee.first_name && rushee.last_name
        ? `${rushee.first_name} ${rushee.last_name}`
        : legacy.name || `${legacy.firstname || ""} ${legacy.lastname || ""}`.trim() || "Unknown Name";
}
