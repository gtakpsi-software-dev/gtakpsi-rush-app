const assert = require('node:assert/strict');
const test = require('node:test');
const { scheduleRoomCleanup } = require('../src/rooms');
const { registerMembershipHandlers } = require('../src/handlers/membership');

test('periodic cleanup removes only empty rooms older than one hour', (t) => {
    const now = Date.parse('2026-09-09T23:00:00Z');
    t.mock.method(Date, 'now', () => now);
    const room = (age, users = []) => ({
        users: new Map(users), lastActivity: new Date(now - age).toISOString(),
    });
    const rooms = new Map([
        ['expired', room(3600001)], ['boundary', room(3600000)],
        ['recent', room(1)], ['occupied', room(7200000, [['brother', {}]])],
    ]);
    let sweep;
    scheduleRoomCleanup(rooms, {
        setInterval(callback, delay) {
            assert.equal(delay, 600000);
            sweep = callback;
        },
    });
    sweep();
    assert.deepEqual([...rooms.keys()], ['boundary', 'recent', 'occupied']);
});

test('disconnect cleanup waits five minutes and retains a room that has been rejoined', () => {
    const handlers = new Map();
    const rooms = new Map();
    const userSockets = new Map();
    const pending = [];
    const socket = {
        id: 'socket-1', on: (name, callback) => handlers.set(name, callback),
        join() {}, emit() {}, to: () => ({ emit() {} }),
    };
    registerMembershipHandlers({ to: () => ({ emit() {} }) }, socket, rooms, userSockets, {
        setTimeout(callback, delay) {
            assert.equal(delay, 300000);
            pending.push(callback);
        },
    });
    const join = () => handlers.get('join-room')({ roomId: 'pis-1', userId: 'brother', userName: 'Brother' });
    join();
    handlers.get('disconnect')();
    assert.equal(userSockets.size, 0);
    assert.equal(rooms.size, 1);
    join();
    pending.shift()();
    assert.equal(rooms.size, 1);
    handlers.get('disconnect')();
    pending.shift()();
    assert.equal(rooms.size, 0);
});
