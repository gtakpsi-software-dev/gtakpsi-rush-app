const { joinedRoom } = require('./joinedRoom');

// Register cursor and typing listeners for joined users.
function registerPresenceHandlers(socket, rooms, membershipsBySocket) {
    for (const eventName of ['cursor-position', 'typing-indicator']) {
        socket.on(eventName, (data) => {
            // Broadcast presence with the joined identity and refresh room activity.
            const joined = joinedRoom(socket, rooms, membershipsBySocket);
            if (!joined) return;
            const { roomId, userInfo, room } = joined;

            room.lastActivity = new Date().toISOString();

            // INVARIANT: broadcast the joined identity, never a user name claimed by the payload.
            socket.to(roomId).emit(eventName, {
                ...data,
                userId: userInfo.id,
                userName: userInfo.name,
                timestamp: Date.now()
            });
        });
    }
}

module.exports = { registerPresenceHandlers };
