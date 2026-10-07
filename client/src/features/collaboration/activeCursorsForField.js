export function activeCursorsForField(collaboration, field, limit) {
    const cursors = collaboration.getActiveCursorsForField
        ? collaboration.getActiveCursorsForField(field)
        : collaboration.connectedUsers.filter(
            (user) => user.field === field && typeof user.cursor === 'number'
        );

    // Textareas cap overlays at three; single-line inputs retain the full active set.
    return limit === undefined ? cursors : cursors.slice(0, limit);
}
