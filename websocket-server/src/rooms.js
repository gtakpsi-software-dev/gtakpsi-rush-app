function scheduleRoomCleanup(rooms, timers) {
    timers.setInterval(() => {
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);

        for (const [roomId, room] of rooms.entries()) {
            const lastActivity = new Date(room.lastActivity).getTime();
            if (lastActivity < oneHourAgo && room.users.size === 0) {
                rooms.delete(roomId);
            }
        }
    }, 10 * 60 * 1000); // Run every 10 minutes
}

function snapshotDocument(room) {
    const documentState = {};
    for (const [field, content] of room.document.entries()) {
        // Legacy operations can change text without a version entry; clients still receive version zero.
        const version = room.versions.get(field) || 0;
        documentState[field] = { value: content, version };
    }
    return documentState;
}

module.exports = { scheduleRoomCleanup, snapshotDocument };
