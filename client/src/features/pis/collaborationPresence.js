// Update one collaborator’s cursor position, field, and timestamp.
export function applyCursorPosition(users, data, clock = Date.now) {
    return users.map(/* Replace cursor details only for the matching collaborator. */ user =>
        user.id === data.userId
            ? {
                ...user,
                cursor: data.position,
                field: data.position === null ? null : data.field,
                cursorTimestamp: data.timestamp || clock()
            }
            : user
    );
}

// Add or remove a collaborator’s typing indicator for a field.
export function applyTypingIndicator(previous, data, clock = Date.now) {
    const next = new Map(previous);
    const key = `${data.userId}-${data.field}`;

    if (data.isTyping) {
        next.set(key, {
            userId: data.userId,
            userName: data.userName,
            field: data.field,
            timestamp: clock()
        });
    } else {
        next.delete(key);
    }

    return next;
}

// Keep typing indicators newer than three seconds.
export function pruneTypingUsers(previous, now) {
    const filtered = new Map();
    for (const [key, value] of previous) {
        if (now - value.timestamp < 3000) {
            filtered.set(key, value);
        }
    }
    return filtered;
}

// Clear cursor ownership older than ten seconds.
export function clearStaleCursors(users, now) {
    return users.map(user => {
        // Clear a stale cursor and field while retaining the collaborator’s other details.
        if (user.cursor !== null && user.cursorTimestamp && now - user.cursorTimestamp > 10000) {
            return { ...user, cursor: null, field: null };
        }
        return user;
    });
}

// Return numeric cursors in the requested field that are still active.
export function getActiveCursors(users, field, now = Date.now()) {
    // Visibility uses a strict ten-second bound; cleanup runs later on its interval.
    return users.filter(/* Keep matching field cursors within the ten-second visibility window. */ user =>
        user.field === field &&
        user.cursor !== null &&
        typeof user.cursor === 'number' &&
        (!user.cursorTimestamp || now - user.cursorTimestamp < 10000)
    );
}
