const { v4: uuidv4 } = require('uuid');
const { transformOperation } = require('../operations');

function registerOperationHandlers(socket, rooms, userSockets) {
    socket.on('text-operation', (operation) => {
        const userData = userSockets.get(socket.id);
        if (!userData) return;

        const { roomId, userInfo } = userData;
        const room = rooms.get(roomId);
        if (!room) return;

        const enhancedOperation = {
            ...operation,
            id: uuidv4(),
            userId: userInfo.id,
            userName: userInfo.name,
            timestamp: Date.now()
        };

        const recentOps = room.operations.slice(-10); // Only consider last 10 operations for performance
        let transformedOp = enhancedOperation;

        for (const existingOp of recentOps) {
            if (existingOp.field === transformedOp.field &&
                Math.abs(existingOp.timestamp - transformedOp.timestamp) < 1000) { // Within 1 second
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
        let newDoc = currentDoc;

        switch (operation.type) {
            case 'insert':
                newDoc = currentDoc.slice(0, operation.position) +
                        (operation.content || '') +
                        currentDoc.slice(operation.position);
                break;
            case 'delete':
                newDoc = currentDoc.slice(0, operation.position) +
                        currentDoc.slice(operation.position + (operation.length || 0));
                break;
            case 'replace':
                newDoc = currentDoc.slice(0, operation.position) +
                        (operation.content || '') +
                        currentDoc.slice(operation.position + (operation.length || 0));
                break;
        }

        room.document.set(operation.field, newDoc);

        socket.to(roomId).emit('text-operation', transformedOp);
    });
}

module.exports = { registerOperationHandlers };
