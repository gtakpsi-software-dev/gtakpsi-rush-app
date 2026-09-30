function registerUpdateHandlers(socket, rooms, userSockets) {
    socket.on('text-update', (payload) => {
        /* payload = { field: string, value: string, userId: string, userName: string, baseVersion: number, clientUpdateId: string } */
        const userData = userSockets.get(socket.id);
        if (!userData) return;

        const { roomId } = userData;
        const room = rooms.get(roomId);
        if (!room) return;

        const field = payload?.field;
        const value = typeof payload?.value === 'string' ? payload.value : '';
        const baseVersion = typeof payload?.baseVersion === 'number' ? payload.baseVersion : undefined;
        const clientUpdateId = typeof payload?.clientUpdateId === 'string' ? payload.clientUpdateId : undefined;

        if (!field || baseVersion === undefined || !clientUpdateId) {
            return; // ignore malformed payloads
        }

        const currentVersion = room.versions.get(field) || 0;

        // Reject stale writes so concurrent editors cannot overwrite a newer version.
        if (baseVersion !== currentVersion) {
            socket.emit('text-reject', {
                field,
                serverValue: room.document.get(field) || '',
                serverVersion: currentVersion,
                clientUpdateId,
                timestamp: Date.now(),
            });
            return;
        }

        room.document.set(field, value);
        const newVersion = currentVersion + 1;
        room.versions.set(field, newVersion);
        room.lastActivity = new Date().toISOString();

        socket.emit('text-ack', {
            field,
            version: newVersion,
            clientUpdateId,
            timestamp: Date.now(),
        });

        socket.to(roomId).emit('text-update', {
            field,
            value,
            version: newVersion,
            userId: payload.userId,
            userName: payload.userName,
            timestamp: Date.now(),
        });
    });
}

module.exports = { registerUpdateHandlers };
