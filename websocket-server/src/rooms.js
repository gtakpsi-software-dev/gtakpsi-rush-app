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

module.exports = { scheduleRoomCleanup };
