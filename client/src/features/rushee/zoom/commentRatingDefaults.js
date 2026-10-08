export const RATING_FIELDS = [
    "Why AKPsi",
    "1:1 Interactions",
    "Group Interactions",
    "Professionalism",
];

const DEFAULT_RATING = 3;

// Initialize every rating category to the default score.
export function createDefaultRatings() {
    return Object.fromEntries(RATING_FIELDS.map(/* Pair a rating category with the default score. */ (field) => [field, DEFAULT_RATING]));
}

// Initialize every rating category as not seen.
export function createDefaultNotSeen() {
    return Object.fromEntries(RATING_FIELDS.map(/* Pair a rating category with the not-seen flag. */ (field) => [field, true]));
}
