const assert = require('node:assert/strict');
const test = require('node:test');
const { scheduleEmptyRoomRemoval, scheduleRoomCleanup } = require('../src/roomRetention');
const { registerMembershipHandlers } = require('../src/handlers/membership');

test('periodic cleanup removes only empty rooms older than one hour', (t) => {
    // Verify that periodic cleanup removes only empty rooms beyond the idle limit.
    const now = Date.parse('2026-09-09T23:00:00Z');
    t.mock.method(Date, 'now', /* Return a fixed clock value for cleanup-boundary assertions. */ () => now);
    // Build a room fixture with the requested age and users.
    const room = (age, users = []) => ({
        users: new Map(users), lastActivity: new Date(now - age).toISOString(),
    });
    const rooms = new Map([
        ['expired', room(3600001)], ['boundary', room(3600000)],
        ['recent', room(1)], ['occupied', room(7200000, [['brother', {}]])],
    ]);
    let sweep;
    scheduleRoomCleanup(rooms, {
        // Capture the scheduled sweep and verify its interval.
        setInterval(callback, delay) {
            assert.equal(delay, 600000);
            sweep = callback;
        },
    });
    sweep();
    assert.deepEqual([...rooms.keys()], ['boundary', 'recent', 'occupied']);
});

test('disconnect cleanup waits five minutes and retains a room that has been rejoined', () => {
    // Verify the disconnect grace period and retention of rejoined rooms.
    const handlers = new Map();
    const rooms = new Map();
    const membershipsBySocket = new Map();
    const pending = [];
    const socket = {
        id: 'socket-1',
        // Capture membership handlers for direct invocation.
        on: (name, callback) => handlers.set(name, callback),
        // Ignore room joining in the fake transport.
        join() {},
        // Ignore direct events in the fake transport.
        emit() {},
        // Provide a no-op peer broadcast target.
        to: () => ({
            // Ignore peer broadcasts in this cleanup test.
            emit() {},
        }),
    };
    registerMembershipHandlers({
        // Provide a no-op server broadcast target.
        to: () => ({
            // Ignore server broadcasts in this cleanup test.
            emit() {},
        }),
    }, socket, rooms, membershipsBySocket, {
        // Capture cleanup timers and verify their grace-period delay.
        setTimeout(callback, delay) {
            assert.equal(delay, 300000);
            pending.push(callback);
        },
    });
    // Join the fixture editor to the test room.
    const join = () => handlers.get('join-room')({ roomId: 'pis-1', userId: 'brother', userName: 'Brother' });
    join();
    handlers.get('disconnect')();
    assert.equal(membershipsBySocket.size, 0);
    assert.equal(rooms.size, 1);
    join();
    pending.shift()();
    assert.equal(rooms.size, 1);
    handlers.get('disconnect')();
    pending.shift()();
    assert.equal(rooms.size, 0);
});

test('a grace timer leaves a recreated room with a new editor intact', () => {
    // Verify that an old grace timer retains a recreated room containing a new editor.
    const rooms = new Map([['pis-1', { users: new Map() }]]);
    let expire;
    scheduleEmptyRoomRemoval(rooms, 'pis-1', {
        // Capture the grace timer for execution after replacing the room.
        setTimeout(callback, delay) {
            assert.equal(delay, 300000);
            expire = callback;
        },
    });

    rooms.delete('pis-1');
    const replacement = { users: new Map([['new-editor', {}]]) };
    rooms.set('pis-1', replacement);
    expire();

    assert.equal(rooms.get('pis-1'), replacement);
});
