function registerPresenceHandlers(socket, rooms, userSockets) {
    for (const eventName of ['cursor-position', 'typing-indicator']) {
        socket.on(eventName, (data) => {
            const userData = userSockets.get(socket.id);
            if (!userData) return;

            const { roomId, userInfo } = userData;
            const room = rooms.get(roomId);
            if (!room) return;

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
