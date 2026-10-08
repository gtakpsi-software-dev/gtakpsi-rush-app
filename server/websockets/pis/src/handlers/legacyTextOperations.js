const { recordLegacyTextOperation } = require('../operations/recordLegacyTextOperation');
const { joinedRoom } = require('./joinedRoom');

// Register the legacy text-edit listener for this socket.
function registerLegacyTextOperationHandlers(socket, rooms, membershipsBySocket) {
    socket.on('text-operation', (operation) => {
        // Record a joined user's legacy edit and broadcast its transformed operation.
        const joined = joinedRoom(socket, rooms, membershipsBySocket);
        if (!joined) return;
        const { roomId, userInfo, room } = joined;

        const transformedOp = recordLegacyTextOperation(room, operation, userInfo);
        socket.to(roomId).emit('text-operation', transformedOp);
    });
}

module.exports = { registerLegacyTextOperationHandlers };
