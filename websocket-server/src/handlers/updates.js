const { joinedRoom } = require('./joinedRoom');
const { parseTextUpdate } = require('./parseTextUpdate');
const { applyVersionedTextUpdate } = require('../operations/versionedText');

function registerUpdateHandlers(socket, rooms, membershipsBySocket) {
    socket.on('text-update', (payload) => {
        const joined = joinedRoom(socket, rooms, membershipsBySocket);
        if (!joined) return;
        const { roomId, room } = joined;

        const update = parseTextUpdate(payload);
        if (!update) return;
        const { field, value, clientUpdateId } = update;
        const result = applyVersionedTextUpdate(room, update);

        if (!result.accepted) {
            socket.emit('text-reject', {
                field,
                serverValue: result.serverValue,
                serverVersion: result.serverVersion,
                clientUpdateId,
                timestamp: Date.now(),
            });
            return;
        }

        socket.emit('text-ack', {
            field,
            version: result.version,
            clientUpdateId,
            timestamp: Date.now(),
        });

        socket.to(roomId).emit('text-update', {
            field,
            value,
            version: result.version,
            userId: payload.userId,
            userName: payload.userName,
            timestamp: Date.now(),
        });
    });
}

module.exports = { registerUpdateHandlers };
