export const RATING_FIELDS = [
    "Why AKPsi",
    "1:1 Interactions",
    "Group Interactions",
    "Professionalism",
];

const DEFAULT_RATING = 3;

export function createDefaultRatings() {
    return Object.fromEntries(RATING_FIELDS.map((field) => [field, DEFAULT_RATING]));
}

export function createDefaultNotSeen() {
    return Object.fromEntries(RATING_FIELDS.map((field) => [field, true]));
}
