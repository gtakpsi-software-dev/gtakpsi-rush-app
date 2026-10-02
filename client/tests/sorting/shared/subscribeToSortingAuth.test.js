import assert from 'node:assert/strict';
import test from 'node:test';

import { subscribeToSortingAuth } from '../../../src/features/sorting/subscribeToSortingAuth.js';

test('completed sorting auth checks do not create another listener', () => {
    const calls = [];
    const cleanup = subscribeToSortingAuth({
        auth: { onAuthStateChanged: () => calls.push('subscribe') },
        authChecked: true,
        fetchData: () => calls.push('fetch'),
        navigate: (path) => calls.push(['navigate', path]),
    });

    assert.equal(cleanup, undefined);
    assert.deepEqual(calls, []);
});

test('sorting auth listener fetches for a user, redirects otherwise, and returns cleanup', () => {
    const calls = [];
    const unsubscribe = () => calls.push('unsubscribe');
    let notify;
    const cleanup = subscribeToSortingAuth({
        auth: {
            onAuthStateChanged: (callback) => {
                calls.push('subscribe');
                notify = callback;
                return unsubscribe;
            },
        },
        authChecked: false,
        fetchData: () => calls.push('fetch'),
        navigate: (path) => calls.push(['navigate', path]),
    });

    notify({ uid: 'brother-1' });
    notify(null);
    assert.notEqual(cleanup, unsubscribe);
    cleanup();
    assert.deepEqual(calls, [
        'subscribe', 'fetch', ['navigate', '/login'], 'unsubscribe',
    ]);
});
