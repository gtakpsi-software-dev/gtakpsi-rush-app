const { joinedRoom } = require('./joinedRoom');

function registerPresenceHandlers(socket, rooms, userSockets) {
    for (const eventName of ['cursor-position', 'typing-indicator']) {
        socket.on(eventName, (data) => {
            const joined = joinedRoom(socket, rooms, userSockets);
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
