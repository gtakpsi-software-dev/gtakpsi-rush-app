function registerPresenceHandlers(socket, rooms, userSockets) {
    socket.on('cursor-position', (data) => {
        const userData = userSockets.get(socket.id);
        if (!userData) return;

        const { roomId, userInfo } = userData;
        const room = rooms.get(roomId);
        if (!room) return;

        room.lastActivity = new Date().toISOString();

        socket.to(roomId).emit('cursor-position', {
            ...data,
            userId: userInfo.id,
            userName: userInfo.name,
            timestamp: Date.now()
        });
    });

    socket.on('typing-indicator', (data) => {
        const userData = userSockets.get(socket.id);
        if (!userData) return;

        const { roomId, userInfo } = userData;
        const room = rooms.get(roomId);
        if (!room) return;

        room.lastActivity = new Date().toISOString();

        socket.to(roomId).emit('typing-indicator', {
            ...data,
            userId: userInfo.id,
            userName: userInfo.name,
            timestamp: Date.now()
        });
    });
}

module.exports = { registerPresenceHandlers };
