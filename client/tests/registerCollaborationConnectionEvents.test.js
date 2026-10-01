import assert from 'node:assert/strict';
import test from 'node:test';

import { registerCollaborationConnectionEvents } from '../src/features/pis/registerCollaborationConnectionEvents.js';

function setup() {
    const handlers = new Map();
    const emitted = [];
    const connectedStates = [];
    const timers = [];
    let reconnects = 0;
    const socket = {
        connected: false,
        on: (name, handler) => handlers.set(name, handler),
        emit: (name, payload) => emitted.push([name, payload]),
    };
    const socketRef = { current: socket };
    const reconnectTimeoutRef = { current: null };

    registerCollaborationConnectionEvents({
        socket,
        socketRef,
        reconnectTimeoutRef,
        roomId: 'pis-room',
        currentUser: { id: 'me', firstName: 'Ada', lastName: 'Lovelace' },
        setIsConnected: (connected) => connectedStates.push(connected),
        reconnect: () => { reconnects += 1; },
        setTimer: (callback, delay) => {
            const timer = { callback, delay };
            timers.push(timer);
            return timer;
        },
    });

    return {
        handlers, emitted, connectedStates, timers, socketRef,
        reconnectTimeoutRef, reconnectCount: () => reconnects,
    };
}

test('connection listeners join the same room with the same user identity', () => {
    const state = setup();
    assert.deepEqual([...state.handlers.keys()], ['connect', 'disconnect', 'connect_error']);

    state.handlers.get('connect')();
    assert.deepEqual(state.connectedStates, [true]);
    assert.deepEqual(state.emitted, [['join-room', {
        roomId: 'pis-room', userId: 'me', userName: 'Ada Lovelace',
    }]]);
});

test('disconnect retries after three seconds only while the socket is disconnected', () => {
    const state = setup();
    state.handlers.get('disconnect')();
    assert.deepEqual(state.connectedStates, [false]);
    assert.equal(state.timers[0].delay, 3000);
    assert.equal(state.reconnectTimeoutRef.current, state.timers[0]);

    state.socketRef.current.connected = true;
    state.timers[0].callback();
    assert.equal(state.reconnectCount(), 0);

    state.socketRef.current.connected = false;
    state.handlers.get('disconnect')();
    state.timers[1].callback();
    assert.equal(state.reconnectCount(), 1);
});

test('connect errors clear connected state without scheduling another retry', () => {
    const state = setup();
    state.handlers.get('connect_error')();
    assert.deepEqual(state.connectedStates, [false]);
    assert.deepEqual(state.timers, []);
});
