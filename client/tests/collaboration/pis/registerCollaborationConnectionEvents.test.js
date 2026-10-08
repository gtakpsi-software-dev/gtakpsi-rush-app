import assert from 'node:assert/strict';
import test from 'node:test';

import { registerCollaborationConnectionEvents } from '../../../src/features/pis/registerCollaborationConnectionEvents.js';

// Create isolated state, dependency fakes, and captured calls for this test.
function setup() {
    const handlers = new Map();
    const emitted = [];
    const connectedStates = [];
    const timers = [];
    let reconnects = 0;
    const socket = {
        connected: false,
        // Invoke handlers.set with the test inputs.
        on: (name, handler) => handlers.set(name, handler),
        // Record emit calls for assertions.
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
        // Record set is connected calls for assertions.
        setIsConnected: (connected) => connectedStates.push(connected),
        // Update reconnects in the test harness.
        reconnect: () => { reconnects += 1; },
        // Capture the reconnect callback and return its timer handle.
        setTimer: (callback, delay) => {
            const timer = { callback, delay };
            timers.push(timer);
            return timer;
        },
    });

    return {
        handlers, emitted, connectedStates, timers, socketRef,
        reconnectTimeoutRef, reconnectCount: /* Return reconnects to the caller. */ () => reconnects,
    };
}

test('connection listeners join the same room with the same user identity', () => {
    // Verify connection listeners join the same room with the same user identity.
    const state = setup();
    assert.deepEqual([...state.handlers.keys()], ['connect', 'disconnect', 'connect_error']);

    state.handlers.get('connect')();
    assert.deepEqual(state.connectedStates, [true]);
    assert.deepEqual(state.emitted, [['join-room', {
        roomId: 'pis-room', userId: 'me', userName: 'Ada Lovelace',
    }]]);
});

test('disconnect retries after three seconds only while the socket is disconnected', () => {
    // Verify disconnect retries after three seconds only while the socket is disconnected.
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
    // Verify connect errors clear connected state without scheduling another retry.
    const state = setup();
    state.handlers.get('connect_error')();
    assert.deepEqual(state.connectedStates, [false]);
    assert.deepEqual(state.timers, []);
});
