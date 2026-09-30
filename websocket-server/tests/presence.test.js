const assert = require('node:assert/strict');
const test = require('node:test');
const { registerPresenceHandlers } = require('../src/handlers/presence');

test('presence ignores unjoined and missing-room sockets', () => {
    const listeners = new Map();
    const emitted = [];
    const socket = {
        id: 'socket-1',
        on: (name, handler) => listeners.set(name, handler),
        to: (roomId) => ({ emit: (name, payload) => emitted.push([roomId, name, payload]) }),
    };
    const rooms = new Map();
    const userSockets = new Map();
    registerPresenceHandlers(socket, rooms, userSockets);

    for (const name of ['cursor-position', 'typing-indicator']) {
        listeners.get(name)({ field: 'notes', userId: 'spoofed' });
    }
    userSockets.set('socket-1', { roomId: 'missing', userInfo: { id: 'joined', name: 'Joined' } });
    for (const name of ['cursor-position', 'typing-indicator']) {
        listeners.get(name)({ field: 'notes', userId: 'spoofed' });
    }
    assert.deepEqual(emitted, []);
});

test('both presence events use joined identity and update room activity', (t) => {
    const now = Date.parse('2026-09-30T12:00:00Z');
    t.mock.method(Date, 'now', () => now);
    const listeners = new Map();
    const emitted = [];
    const socket = {
        id: 'socket-1',
        on: (name, handler) => listeners.set(name, handler),
        to: (roomId) => ({ emit: (name, payload) => emitted.push([roomId, name, payload]) }),
    };
    const room = { lastActivity: 'old' };
    const rooms = new Map([['pis-1', room]]);
    const userSockets = new Map([['socket-1', {
        roomId: 'pis-1', userInfo: { id: 'brother-1', name: 'Brother One' },
    }]]);
    registerPresenceHandlers(socket, rooms, userSockets);

    listeners.get('cursor-position')({ field: 'notes', position: 3, userId: 'spoofed', userName: 'Spoofed' });
    listeners.get('typing-indicator')({ field: 'notes', isTyping: true, userId: 'spoofed', userName: 'Spoofed' });

    assert.deepEqual(emitted, [
        ['pis-1', 'cursor-position', {
            field: 'notes', position: 3, userId: 'brother-1', userName: 'Brother One', timestamp: now,
        }],
        ['pis-1', 'typing-indicator', {
            field: 'notes', isTyping: true, userId: 'brother-1', userName: 'Brother One', timestamp: now,
        }],
    ]);
    assert.ok(Number.isFinite(Date.parse(room.lastActivity)));
});
