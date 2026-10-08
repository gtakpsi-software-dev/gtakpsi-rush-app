import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadVotingSocketHook } from '../helpers/loadVotingSocketHook.js';

const hookPath = fileURLToPath(new URL('../../src/features/voting/admin/useAdminVotingSocket.ts', import.meta.url));

// Invoke loadVotingSocketHook with the test inputs.
async function loadHook() {
    return loadVotingSocketHook(hookPath, 'useAdminVotingSocket');
}

test('admin voting socket gates connection and preserves event payloads', async () => {
    // Verify admin voting socket gates connection and preserves event payloads.
    const { useAdminVotingSocket, effects, sockets, errors } = await loadHook();
    const statuses = [];
    const votes = [];
    const rushees = [];
    const questions = [];
    const refs = {
        socketRef: { current: null },
        reconnectTimeoutRef: { current: null },
        reconnectAttemptsRef: { current: 0 },
    };
    const options = {
        ...refs,
        authorized: false,
        user: { _id: 'brother-1' },
        votingWebSocketUrl: 'ws://voting',
        // Record set connection status calls for assertions.
        setConnectionStatus: (status) => statuses.push(status),
        // Record set votes calls for assertions.
        setVotes: (value) => votes.push(value),
        // Record set rushee calls for assertions.
        setRushee: (value) => rushees.push(value),
        // Record set question calls for assertions.
        setQuestion: (value) => questions.push(value),
    };

    useAdminVotingSocket(options);
    effects.pop()();
    assert.equal(sockets.length, 0);

    useAdminVotingSocket({ ...options, authorized: true });
    const cleanup = effects.pop()();
    assert.equal(sockets.length, 1);
    assert.equal(sockets[0].url, 'ws://voting/admin/brother-1');
    assert.deepEqual(statuses, ['connecting']);

    const socket = sockets[0];
    socket.onopen();
    assert.deepEqual(statuses, ['connecting', 'connected']);
    socket.onmessage({ data: JSON.stringify({ type: 'vote_update', votes: [{ vote: 'Yes' }] }) });
    socket.onmessage({ data: JSON.stringify({ type: 'rushee_update', rushee: '{"gtid":"123"}' }) });
    socket.onmessage({ data: JSON.stringify({ type: 'rushee_update', rushee: { gtid: '456' } }) });
    socket.onmessage({ data: JSON.stringify({ type: 'question_update', question: 'Prompt' }) });
    socket.onmessage({ data: '{invalid' });
    assert.deepEqual(JSON.parse(JSON.stringify(votes)), [[{ vote: 'Yes' }]]);
    assert.deepEqual(JSON.parse(JSON.stringify(rushees)), [{ gtid: '123' }, { gtid: '456' }]);
    assert.deepEqual(questions, ['Prompt']);
    assert.equal(errors.length, 1);
    cleanup();
    assert.equal(socket.closeCalls, 1);
});

test('admin voting socket retains reconnect backoff, reset, and error close', async () => {
    // Verify admin voting socket retains reconnect backoff, reset, and error close.
    const { useAdminVotingSocket, effects, sockets, timers } = await loadHook();
    const statuses = [];
    const socketRef = { current: null };
    const reconnectTimeoutRef = { current: null };
    const reconnectAttemptsRef = { current: 0 };
    useAdminVotingSocket({
        authorized: true,
        user: { _id: 'brother-1' },
        votingWebSocketUrl: 'ws://voting',
        socketRef, reconnectTimeoutRef, reconnectAttemptsRef,
        // Record set connection status calls for assertions.
        setConnectionStatus: (status) => statuses.push(status),
        // Provide an inert set votes stub for this test.
        setVotes() {},
            /* Provide an inert set rushee stub for this test. */
            setRushee() {},
            /* Provide an inert set question stub for this test. */
            setQuestion() {},
    });
    const cleanup = effects.pop()();
    sockets[0].onclose();
    assert.deepEqual([...timers.values()].map(/* Return delay to the caller. */ ({ delay }) => delay), [1000]);
    [...timers.values()][0].callback();
    assert.equal(sockets.length, 2);
    assert.equal(timers.size, 0);
    sockets[1].onclose();
    assert.deepEqual([...timers.values()].map(/* Return delay to the caller. */ ({ delay }) => delay), [2000]);

    sockets[1].onopen();
    assert.equal(reconnectAttemptsRef.current, 0);
    sockets[1].onerror(new Error('connection'));
    assert.equal(sockets[1].closeCalls, 1);
    cleanup();
    assert.equal(timers.size, 0);
    assert.equal(sockets[1].closeCalls, 2);
    assert.equal(statuses.includes('disconnected'), true);
});

test('admin voting socket caps reconnect delay at 30 seconds', async () => {
    // Verify admin voting socket caps reconnect delay at 30 seconds.
    const { useAdminVotingSocket, effects, sockets, timers } = await loadHook();
    const reconnectAttemptsRef = { current: 7 };
    useAdminVotingSocket({
        authorized: true,
        user: { _id: 'brother-1' },
        votingWebSocketUrl: 'ws://voting',
        socketRef: { current: null },
        reconnectTimeoutRef: { current: null },
        reconnectAttemptsRef,
        // Provide an inert set connection status stub for this test.
        setConnectionStatus() {},
            /* Provide an inert set votes stub for this test. */
            setVotes() {},
            /* Provide an inert set rushee stub for this test. */
            setRushee() {},
            /* Provide an inert set question stub for this test. */
            setQuestion() {},
    });
    const cleanup = effects.pop()();
    sockets[0].onclose();
    assert.deepEqual([...timers.values()].map(/* Return delay to the caller. */ ({ delay }) => delay), [30000]);
    assert.equal(reconnectAttemptsRef.current, 8);
    cleanup();
    assert.equal(timers.size, 0);
});
