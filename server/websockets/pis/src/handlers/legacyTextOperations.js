const { recordLegacyTextOperation } = require('../operations/recordLegacyTextOperation');
const { joinedRoom } = require('./joinedRoom');

function registerLegacyTextOperationHandlers(socket, rooms, membershipsBySocket) {
    socket.on('text-operation', (operation) => {
        const joined = joinedRoom(socket, rooms, membershipsBySocket);
        if (!joined) return;
        const { roomId, userInfo, room } = joined;

        const transformedOp = recordLegacyTextOperation(room, operation, userInfo);
        socket.to(roomId).emit('text-operation', transformedOp);
    });
}

module.exports = { registerLegacyTextOperationHandlers };
