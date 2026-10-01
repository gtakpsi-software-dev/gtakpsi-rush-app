const { joinedRoom } = require('./joinedRoom');
const { parseTextUpdate } = require('./parseTextUpdate');

function registerUpdateHandlers(socket, rooms, userSockets) {
    socket.on('text-update', (payload) => {
        const joined = joinedRoom(socket, rooms, userSockets);
        if (!joined) return;
        const { roomId, room } = joined;

        const update = parseTextUpdate(payload);
        if (!update) return;
        const { field, value, baseVersion, clientUpdateId } = update;

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
