export const STATUSES = [
    { key: "UNSORTED", label: "Unsorted" },
    { key: "IN_CLOUD", label: "In Cloud" },
    { key: "MID_CLOUD", label: "Mid Cloud" },
    { key: "OUT_CLOUD", label: "Out Cloud" },
    { key: "DISCUSSED", label: "Discussed Rushees" },
    { key: "INELIGIBLE", label: "Ineligible" },
];

export const TAGS = [
    { key: "night_1", label: "Night 1", color: "bg-blue-100 text-blue-700 border-blue-200" },
    { key: "night_2", label: "Night 2", color: "bg-purple-100 text-purple-700 border-purple-200" },
    { key: "closed_night", label: "Closed Night", color: "bg-amber-100 text-amber-700 border-amber-200" },
    { key: "closed_night_invite", label: "Closed Night Invite", color: "bg-orange-100 text-orange-700 border-orange-200" },
    { key: "pis", label: "PIS", color: "bg-green-100 text-green-700 border-green-200" },
    { key: "hard_no", label: "Hard No", color: "bg-red-100 text-red-600 border-red-200" },
];

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 2;

// Create an empty list for every sorting status.
export function createEmptyColumns() {
    return {
        UNSORTED: [],
        IN_CLOUD: [],
        MID_CLOUD: [],
        OUT_CLOUD: [],
        DISCUSSED: [],
        INELIGIBLE: [],
    };
}

// Group rows by status and sort each column by saved order.
export function groupSortingRows(rows) {
    const grouped = createEmptyColumns();
    rows.forEach((r) => {
        // Place a row in its status column, defaulting unknown statuses to Unsorted.
        if (grouped[r.sortingStatus]) {
            grouped[r.sortingStatus].push(r);
        } else {
            grouped.UNSORTED.push(r);
        }
    });
    Object.keys(grouped).forEach((k) => {
        // Sort one column by its saved order.
        grouped[k].sort(/* Compare saved sorting positions. */ (a, b) => a.sortingOrder - b.sortingOrder);
    });
    return grouped;
}
