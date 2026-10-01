const { v4: uuidv4 } = require('uuid');
const { transformOperation, applyOperation } = require('../operations/legacyText');
const { joinedRoom } = require('./joinedRoom');

function registerLegacyTextOperationHandlers(socket, rooms, membershipsBySocket) {
    socket.on('text-operation', (operation) => {
        const joined = joinedRoom(socket, rooms, membershipsBySocket);
        if (!joined) return;
        const { roomId, userInfo, room } = joined;

        const enhancedOperation = {
            ...operation,
            id: uuidv4(),
            userId: userInfo.id,
            userName: userInfo.name,
            timestamp: Date.now()
        };

        // Bound transform work to ten recent edits; older positions are not rebased.
        const recentOps = room.operations.slice(-10);
        let transformedOp = enhancedOperation;

        for (const existingOp of recentOps) {
            if (existingOp.field === transformedOp.field &&
                Math.abs(existingOp.timestamp - transformedOp.timestamp) < 1000) {
                transformedOp = transformOperation(existingOp, transformedOp);
            }
        }

        room.operations.push(transformedOp);
        room.lastActivity = new Date().toISOString();

        // Bound per-room history so long editing sessions do not grow memory indefinitely.
        if (room.operations.length > 100) {
            room.operations = room.operations.slice(-100);
        }

        // Legacy clients receive transformed positions, but stored text uses the
        // original operation. Keep these paths distinct for protocol compatibility.
        const currentDoc = room.document.get(operation.field) || '';
        room.document.set(operation.field, applyOperation(currentDoc, operation));

        socket.to(roomId).emit('text-operation', transformedOp);
    });
}

module.exports = { registerLegacyTextOperationHandlers };
