// Empty rooms stay available for reconnects; both timers remove them only
// while they remain empty, so a returning editor keeps the document state.
const EMPTY_ROOM_GRACE_MS = 5 * 60 * 1000;
const IDLE_ROOM_LIMIT_MS = 60 * 60 * 1000;
const ROOM_SWEEP_INTERVAL_MS = 10 * 60 * 1000;

// Schedule removal of a room that remains empty after the reconnect grace period.
function scheduleEmptyRoomRemoval(rooms, roomId, timers) {
    timers.setTimeout(() => {
        // Remove the room only if it still exists and has no users.
        const currentRoom = rooms.get(roomId);
        if (currentRoom && currentRoom.users.size === 0) {
            rooms.delete(roomId);
        }
    }, EMPTY_ROOM_GRACE_MS);
}

// Schedule periodic removal of inactive, empty rooms.
function scheduleRoomCleanup(rooms, timers) {
    timers.setInterval(() => {
        // Remove empty rooms whose last activity is more than an hour old.
        const now = Date.now();
        const idleBefore = now - IDLE_ROOM_LIMIT_MS;

        for (const [roomId, room] of rooms.entries()) {
            const lastActivity = new Date(room.lastActivity).getTime();
            if (lastActivity < idleBefore && room.users.size === 0) {
                rooms.delete(roomId);
            }
        }
    }, ROOM_SWEEP_INTERVAL_MS);
}

module.exports = { scheduleEmptyRoomRemoval, scheduleRoomCleanup };
