const { v4: uuidv4 } = require('uuid');
const { transformOperation, applyOperation } = require('./legacyText');

function recordLegacyTextOperation(room, operation, userInfo, {
    generateId = uuidv4,
    now = Date.now,
    activityTime = () => new Date().toISOString(),
} = {}) {
    const enhancedOperation = {
        ...operation,
        id: generateId(),
        userId: userInfo.id,
        userName: userInfo.name,
        timestamp: now()
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
    room.lastActivity = activityTime();

    // Bound per-room history so long editing sessions do not grow memory indefinitely.
    if (room.operations.length > 100) {
        room.operations = room.operations.slice(-100);
    }

    // Legacy clients receive transformed positions, but stored text uses the
    // original operation. Keep these paths distinct for protocol compatibility.
    const currentDoc = room.document.get(operation.field) || '';
    room.document.set(operation.field, applyOperation(currentDoc, operation));

    return transformedOp;
}

module.exports = { recordLegacyTextOperation };
