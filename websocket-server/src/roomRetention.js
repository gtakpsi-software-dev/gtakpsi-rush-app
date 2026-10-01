// Empty rooms stay available for reconnects; both timers remove them only
// while they remain empty, so a returning editor keeps the document state.
const EMPTY_ROOM_GRACE_MS = 5 * 60 * 1000;
const IDLE_ROOM_LIMIT_MS = 60 * 60 * 1000;
const ROOM_SWEEP_INTERVAL_MS = 10 * 60 * 1000;

function scheduleEmptyRoomRemoval(rooms, roomId, timers) {
    timers.setTimeout(() => {
        const currentRoom = rooms.get(roomId);
        if (currentRoom && currentRoom.users.size === 0) {
            rooms.delete(roomId);
        }
    }, EMPTY_ROOM_GRACE_MS);
}

function scheduleRoomCleanup(rooms, timers) {
    timers.setInterval(() => {
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
