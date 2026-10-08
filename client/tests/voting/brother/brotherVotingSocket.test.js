import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadVotingSocketHook } from '../../helpers/loadVotingSocketHook.js';

const hookPath = fileURLToPath(new URL('../../../src/features/voting/brother/useBrotherVotingSocket.ts', import.meta.url));

// Invoke loadVotingSocketHook with the test inputs.
async function loadHook() {
    return loadVotingSocketHook(hookPath, 'useBrotherVotingSocket');
}

// Return the options fixture for this scenario.
function options(overrides = {}) {
    return {
        user: { _id: 'brother-1' },
        votingWebSocketUrl: 'ws://voting',
        socketRef: { current: null },
        reconnectTimeoutRef: { current: null },
        reconnectAttemptsRef: { current: 0 },
        // Provide an inert set connection status stub for this test.
        setConnectionStatus() {},
        // Provide an inert set rushee stub for this test.
        setRushee() {},
        // Provide an inert set question stub for this test.
        setQuestion() {},
        ...overrides,
    };
}

test('brother voting socket gates connection and preserves voter messages', async () => {
    // Verify brother voting socket gates connection and preserves voter messages.
    const { useBrotherVotingSocket, effects, sockets, errors } = await loadHook();
    const statuses = [];
    const rushees = [];
    const questions = [];
    useBrotherVotingSocket(options({ user: null }));
    effects.pop()();
    assert.equal(sockets.length, 0);

    useBrotherVotingSocket(options({
        // Record set connection status calls for assertions.
        setConnectionStatus: (status) => statuses.push(status),
        // Record set rushee calls for assertions.
        setRushee: (value) => rushees.push(value),
        // Record set question calls for assertions.
        setQuestion: (value) => questions.push(value),
    }));
    const cleanup = effects.pop()();
    assert.equal(sockets[0].url, 'ws://voting/voter/brother-1');
    assert.deepEqual(statuses, ['connecting']);

    sockets[0].onopen();
    sockets[0].onmessage({ data: JSON.stringify({ type: 'rushee_update', rushee: '{"gtid":"123"}' }) });
    sockets[0].onmessage({ data: JSON.stringify({ type: 'rushee_update', rushee: { gtid: '456' } }) });
    sockets[0].onmessage({ data: JSON.stringify({ type: 'question_update', question: 'Prompt' }) });
    sockets[0].onmessage({ data: JSON.stringify({ type: 'vote_update', votes: [] }) });
    sockets[0].onmessage({ data: '{invalid' });
    assert.deepEqual(statuses, ['connecting', 'connected']);
    assert.deepEqual(JSON.parse(JSON.stringify(rushees)), [{ gtid: '123' }, { gtid: '456' }]);
    assert.deepEqual(questions, ['Prompt']);
    assert.equal(errors.length, 1);
    cleanup();
    assert.equal(sockets[0].closeCalls, 1);
});

test('brother voting socket preserves reconnect delay, reset, error close, and cleanup', async () => {
    // Verify brother voting socket preserves reconnect delay, reset, error close, and cleanup.
    const { useBrotherVotingSocket, effects, sockets, timers, errors } = await loadHook();
    const reconnectTimeoutRef = { current: null };
    const reconnectAttemptsRef = { current: 0 };
    const statuses = [];
    useBrotherVotingSocket(options({
        reconnectTimeoutRef, reconnectAttemptsRef,
        // Record set connection status calls for assertions.
        setConnectionStatus: (status) => statuses.push(status),
    }));
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
    const failure = new Error('connection');
    sockets[1].onerror(failure);
    assert.equal(sockets[1].closeCalls, 1);
    assert.deepEqual(errors[0], ['WebSocket error', failure]);
    cleanup();
    assert.equal(timers.size, 0);
    assert.equal(sockets[1].closeCalls, 2);
    assert.equal(statuses.includes('disconnected'), true);
});

test('brother voting socket caps reconnect delay at 30 seconds', async () => {
    // Verify brother voting socket caps reconnect delay at 30 seconds.
    const { useBrotherVotingSocket, effects, sockets, timers } = await loadHook();
    const reconnectAttemptsRef = { current: 7 };
    useBrotherVotingSocket(options({ reconnectAttemptsRef }));
    const cleanup = effects.pop()();
    sockets[0].onclose();
    assert.deepEqual([...timers.values()].map(/* Return delay to the caller. */ ({ delay }) => delay), [30000]);
    assert.equal(reconnectAttemptsRef.current, 8);
    cleanup();
    assert.equal(timers.size, 0);
});
