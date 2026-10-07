export function applyCursorPosition(users, data, clock = Date.now) {
    return users.map(user =>
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

export function pruneTypingUsers(previous, now) {
    const filtered = new Map();
    for (const [key, value] of previous) {
        if (now - value.timestamp < 3000) {
            filtered.set(key, value);
        }
    }
    return filtered;
}

export function clearStaleCursors(users, now) {
    return users.map(user => {
        if (user.cursor !== null && user.cursorTimestamp && now - user.cursorTimestamp > 10000) {
            return { ...user, cursor: null, field: null };
        }
        return user;
    });
}

export function getActiveCursors(users, field, now = Date.now()) {
    // Visibility uses a strict ten-second bound; cleanup runs later on its interval.
    return users.filter(user =>
        user.field === field &&
        user.cursor !== null &&
        typeof user.cursor === 'number' &&
        (!user.cursorTimestamp || now - user.cursorTimestamp < 10000)
    );
}
