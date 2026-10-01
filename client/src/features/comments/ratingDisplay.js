/**
 * Format a per-comment rating value for display.
 * Legacy binary ratings (0 only) keep their old label; 1–5 uses score format.
 */
export function formatRatingValue(value) {
    const num = Number(value);
    if (num === 0) return "Unsatisfactory";
    if (num >= 1 && num <= 5) return `${Math.round(num)}/5`;
    return String(value);
}

export function ratingBadgeClass(value) {
    const num = Number(value);
    if (num === 0) return "bg-red-100 text-red-700";
    if (num >= 4) return "bg-green-100 text-green-700";
    if (num >= 3) return "bg-apple-gray-100 text-apple-gray-700";
    return "bg-red-50 text-red-600";
}
