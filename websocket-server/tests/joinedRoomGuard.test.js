const assert = require('node:assert/strict');
const test = require('node:test');

const { registerLegacyTextOperationHandlers } = require('../src/handlers/legacyTextOperations');
const { registerUpdateHandlers } = require('../src/handlers/updates');
const { registerPresenceHandlers } = require('../src/handlers/presence');

test('unjoined and stale sockets cannot send text or presence events', () => {
    const listeners = new Map();
    const emitted = [];
    const socket = {
        id: 'socket-1',
        on: (name, handler) => listeners.set(name, handler),
        emit: (name, payload) => emitted.push(['direct', name, payload]),
        to: (roomId) => ({ emit: (name, payload) => emitted.push([roomId, name, payload]) }),
    };
    const rooms = new Map();
    const membershipsBySocket = new Map();
    registerLegacyTextOperationHandlers(socket, rooms, membershipsBySocket);
    registerUpdateHandlers(socket, rooms, membershipsBySocket);
    registerPresenceHandlers(socket, rooms, membershipsBySocket);

    const events = [
        ['text-operation', { field: 'notes', type: 'insert', position: 0, content: 'x' }],
        ['text-update', { field: 'notes', value: 'x', baseVersion: 0, clientUpdateId: 'update-1' }],
        ['cursor-position', { field: 'notes', position: 1 }],
        ['typing-indicator', { field: 'notes', isTyping: true }],
    ];

    for (const [name, payload] of events) listeners.get(name)(payload);
    membershipsBySocket.set(socket.id, {
        roomId: 'missing',
        userInfo: { id: 'brother-1', name: 'Brother One' },
    });
    for (const [name, payload] of events) listeners.get(name)(payload);

    assert.deepEqual(emitted, []);
    assert.equal(rooms.size, 0);
});
