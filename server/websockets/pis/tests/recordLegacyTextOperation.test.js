const assert = require('node:assert/strict');
const test = require('node:test');

const { createRoom } = require('../src/rooms');
const { recordLegacyTextOperation } = require('../src/operations/recordLegacyTextOperation');

const options = {
    // Return a fixed operation ID for repeatable assertions.
    generateId: () => 'operation-1',
    // Return a fixed operation timestamp for rebasing tests.
    now: () => 1000,
    // Return a fixed room-activity timestamp.
    activityTime: () => '2026-10-01T00:00:00.000Z',
};

test('recent legacy edits shift the broadcast position but stored text uses the original edit', () => {
    // Verify rebased broadcasts while stored text uses the original edit position.
    const room = createRoom();
    room.document.set('notes', 'abc');
    room.operations.push({
        field: 'notes', type: 'insert', position: 0, content: 'Q', timestamp: 1,
    });
    const operation = { field: 'notes', type: 'insert', position: 0, content: 'X' };

    const broadcast = recordLegacyTextOperation(room, operation, {
        id: 'brother-1', name: 'Brother One',
    }, options);

    assert.deepEqual(broadcast, {
        ...operation, id: 'operation-1', userId: 'brother-1',
        userName: 'Brother One', timestamp: 1000, position: 1,
    });
    assert.equal(room.document.get('notes'), 'Xabc');
    assert.equal(room.operations.at(-1), broadcast);
    assert.equal(room.lastActivity, '2026-10-01T00:00:00.000Z');
});

test('only the last ten operations and edits less than one second apart transform', () => {
    // Verify the ten-operation history window and strict one-second rebasing boundary.
    const room = createRoom();
    room.operations.push({
        field: 'notes', type: 'insert', position: 0, content: 'old', timestamp: 999,
    });
    for (let index = 0; index < 9; index += 1) {
        room.operations.push({ field: 'other', timestamp: 999 });
    }
    room.operations.push({
        field: 'notes', type: 'insert', position: 0, content: 'boundary', timestamp: 0,
    });

    const broadcast = recordLegacyTextOperation(room, {
        field: 'notes', type: 'insert', position: 0, content: 'X',
    }, { id: 'brother-1', name: 'Brother One' }, options);

    assert.equal(broadcast.position, 0);
    assert.equal(room.operations.length, 12);
    assert.equal(room.document.get('notes'), 'X');
});
