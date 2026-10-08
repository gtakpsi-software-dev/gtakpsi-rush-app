import assert from 'node:assert/strict';
import test from 'node:test';

import { subscribeToSortingAuth } from '../../../src/features/sorting/subscribeToSortingAuth.js';

test('completed sorting auth checks do not create another listener', () => {
    // Verify completed sorting auth checks do not create another listener.
    const calls = [];
    const cleanup = subscribeToSortingAuth({
        auth: { onAuthStateChanged: /* Record on auth state changed calls for assertions. */ () => calls.push('subscribe') },
        authChecked: true,
        // Record fetch data calls for assertions.
        fetchData: () => calls.push('fetch'),
        // Record navigate calls for assertions.
        navigate: (path) => calls.push(['navigate', path]),
    });

    assert.equal(cleanup, undefined);
    assert.deepEqual(calls, []);
});

test('sorting auth listener fetches for a user, redirects otherwise, and returns cleanup', () => {
    // Verify sorting auth listener fetches for a user, redirects otherwise, and returns cleanup.
    const calls = [];
    // Record unsubscribe calls for assertions.
    const unsubscribe = () => calls.push('unsubscribe');
    let notify;
    const cleanup = subscribeToSortingAuth({
        auth: {
            // Capture the auth listener and return its unsubscribe callback.
            onAuthStateChanged: (callback) => {
                calls.push('subscribe');
                notify = callback;
                return unsubscribe;
            },
        },
        authChecked: false,
        // Record fetch data calls for assertions.
        fetchData: () => calls.push('fetch'),
        // Record navigate calls for assertions.
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
