// Find active remote cursors for a field, optionally limiting the returned count.
export function activeCursorsForField(collaboration, field, limit) {
    const cursors = collaboration.getActiveCursorsForField
        ? collaboration.getActiveCursorsForField(field)
        : collaboration.connectedUsers.filter(
            /* Keep users with a numeric cursor in the requested field. */ (user) => user.field === field && typeof user.cursor === 'number'
        );

    // Textareas cap overlays at three; single-line inputs retain the full active set.
    return limit === undefined ? cursors : cursors.slice(0, limit);
}
