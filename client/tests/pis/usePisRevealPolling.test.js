import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadTsxModule } from '../helpers/loadTsxComponent.js';

const hookPath = fileURLToPath(new URL('../../src/features/pis/usePisRevealPolling.js', import.meta.url));

test('PIS reveal effect retains its gates, dependencies, polling inputs, and cleanup', async () => {
    // Verify PIS reveal effect retains its gates, dependencies, polling inputs, and cleanup.
    const effects = [];
    const calls = [];
    // Record cleanup calls for assertions.
    const cleanup = () => calls.push(['cleanup']);
    const axios = { get: /* Record get calls for assertions. */ (...args) => calls.push(['get', ...args]) };
    const { usePisRevealPolling } = await loadTsxModule(hookPath, {
        react: { useEffect:
            /* Capture effects so the test can run them explicitly. */
            (effect, dependencies) => effects.push({ effect, dependencies }) },
        axios,
        './startPisRevealPolling': {
            // Capture polling options and return the cleanup callback.
            startPisRevealPolling: (options) => {
                calls.push(['start', options]);
                return cleanup;
            },
        },
    }, {
        Date: { now: /* Return a fixed value to keep the test deterministic. */ () => 123 },
        // Record scheduling and return a fixed timer ID.
        setInterval: (callback, delay) => {
            calls.push(['schedule', callback, delay]);
            return 42;
        },
        // Record clear interval calls for assertions.
        clearInterval: (id) => calls.push(['clear', id]),
    });
    const setters = {
        // Provide an inert set questions stub for this test.
        setQuestions: () => {}, setQuestionsAvailable:
            /* Provide an inert set questions available stub for this test. */
            () => {}, setRevealAt:
            /* Provide an inert set reveal at stub for this test. */
            () => {},
    };
    const revealAt = new Date('2026-10-01T12:00:00Z');
    const options = {
        loading: false, questionsAvailable: false, revealAt,
        api: '/api', gtid: '123', ...setters,
    };

    usePisRevealPolling({ ...options, loading: true });
    assert.equal(effects.at(-1).effect(), undefined);
    usePisRevealPolling({ ...options, questionsAvailable: true });
    assert.equal(effects.at(-1).effect(), undefined);
    usePisRevealPolling({ ...options, revealAt: null });
    assert.equal(effects.at(-1).effect(), undefined);
    assert.deepEqual(calls, []);

    usePisRevealPolling(options);
    assert.deepEqual(Array.from(effects.at(-1).dependencies), [
        false, false, revealAt, '/api', '123',
    ]);
    assert.equal(effects.at(-1).effect(), cleanup);
    const polling = calls[0][1];
    assert.equal(calls[0][0], 'start');
    assert.equal(polling.revealAt, revealAt);
    assert.equal(polling.api, '/api');
    assert.equal(polling.gtid, '123');
    for (const [name, setter] of Object.entries(setters)) {
        assert.equal(polling[name], setter);
    }
    polling.get('/api/rushee/get-pis-questions/123');
    assert.deepEqual(calls[1], ['get', '/api/rushee/get-pis-questions/123']);
    assert.equal(polling.now(), 123);
    // Provide an inert tick stub for this test.
    const tick = () => {};
    assert.equal(polling.scheduleInterval(tick, 1000), 42);
    polling.clearScheduledInterval(42);
    cleanup();
    assert.deepEqual(calls.slice(2), [
        ['schedule', tick, 1000], ['clear', 42], ['cleanup'],
    ]);
});
