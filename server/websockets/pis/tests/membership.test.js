const assert = require('node:assert/strict');
const test = require('node:test');
const { registerMembershipHandlers } = require('../src/handlers/membership');

function setup() {
    const handlers = new Map();
    const direct = [];
    const broadcasts = [];
    const socket = {
        id: 'socket-1',
        on: (name, handler) => handlers.set(name, handler),
        join: (roomId) => broadcasts.push(['join', roomId]),
        emit: (name, payload) => direct.push([name, payload]),
        to: (roomId) => ({ emit: (name, payload) => broadcasts.push([roomId, name, payload]) }),
    };
    const io = {
        to: (roomId) => ({ emit: (name, payload) => broadcasts.push([roomId, name, payload]) }),
    };
    const rooms = new Map();
    const membershipsBySocket = new Map();
    registerMembershipHandlers(io, socket, rooms, membershipsBySocket, { setTimeout() {} });
    return { handlers, direct, broadcasts, rooms, membershipsBySocket };
}

test('join and explicit requests serialize the same document fields and legacy version zero', () => {
    const state = setup();
    const room = {
        users: new Map(), operations: [],
        document: new Map([['notes', 'Saved text'], ['legacy', 'Older text']]),
        versions: new Map([['notes', 3]]),
        lastActivity: 'old',
    };
    state.rooms.set('pis-1', room);

    state.handlers.get('join-room')({ roomId: 'pis-1', userId: 'brother-1', userName: 'Brother One' });
    state.handlers.get('request-document-state')();

    assert.deepEqual(state.direct, [
        ['document-state', {
            notes: { value: 'Saved text', version: 3 },
            legacy: { value: 'Older text', version: 0 },
        }],
        ['document-state', {
            notes: { value: 'Saved text', version: 3 },
            legacy: { value: 'Older text', version: 0 },
        }],
    ]);
    assert.notEqual(state.direct[0][1], state.direct[1][1]);
    assert.equal(state.membershipsBySocket.get('socket-1').roomId, 'pis-1');
    assert.equal(room.users.get('brother-1').name, 'Brother One');
    assert.ok(Number.isFinite(Date.parse(room.lastActivity)));
    assert.equal(state.broadcasts[1][1], 'users-updated');
});

test('document-state requests without a joined room remain silent', () => {
    const state = setup();
    state.handlers.get('request-document-state')();
    state.membershipsBySocket.set('socket-1', { roomId: 'missing' });
    state.handlers.get('request-document-state')();
    assert.deepEqual(state.direct, []);
});

test('joining a new room initializes independent text, version, and presence state', () => {
    const state = setup();
    state.handlers.get('join-room')({ roomId: 'pis-1', userId: 'brother-1', userName: 'Brother One' });
    state.handlers.get('join-room')({ roomId: 'pis-2', userId: 'brother-2', userName: 'Brother Two' });

    const first = state.rooms.get('pis-1');
    const second = state.rooms.get('pis-2');
    assert.deepEqual([...first.users.keys()], ['brother-1']);
    assert.deepEqual([...second.users.keys()], ['brother-2']);
    assert.deepEqual(first.operations, []);
    assert.deepEqual([...first.document], []);
    assert.deepEqual([...first.versions], []);
    assert.notEqual(first.operations, second.operations);
    assert.notEqual(first.document, second.document);
    assert.notEqual(first.versions, second.versions);
    assert.ok(Number.isFinite(Date.parse(first.lastActivity)));
    assert.deepEqual(state.direct.map(([name, payload]) => [name, payload]), [
        ['document-state', {}], ['document-state', {}],
    ]);
});

test('disconnect after joining another room removes only the latest membership', () => {
    const state = setup();
    state.handlers.get('join-room')({ roomId: 'pis-1', userId: 'brother-1', userName: 'Brother One' });
    state.handlers.get('join-room')({ roomId: 'pis-2', userId: 'brother-2', userName: 'Brother Two' });

    state.handlers.get('disconnect')();

    assert.deepEqual([...state.rooms.get('pis-1').users.keys()], ['brother-1']);
    assert.deepEqual([...state.rooms.get('pis-2').users.keys()], []);
    assert.equal(state.membershipsBySocket.has('socket-1'), false);
    assert.deepEqual(state.broadcasts.at(-1), ['pis-2', 'users-updated', []]);
});

test('disconnect clears stale membership after its room has already expired', () => {
    const state = setup();
    state.membershipsBySocket.set('socket-1', {
        roomId: 'expired',
        userInfo: { id: 'brother-1', name: 'Brother One' },
    });

    state.handlers.get('disconnect')();

    assert.equal(state.membershipsBySocket.has('socket-1'), false);
    assert.deepEqual(state.broadcasts, []);
});
