import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadTsxModule } from './helpers/loadTsxComponent.js';

const hookPath = fileURLToPath(new URL('../src/features/pis/usePisRevealPolling.js', import.meta.url));

test('PIS reveal effect retains its gates, dependencies, polling inputs, and cleanup', async () => {
    const effects = [];
    const calls = [];
    const cleanup = () => calls.push(['cleanup']);
    const axios = { get: (...args) => calls.push(['get', ...args]) };
    const { usePisRevealPolling } = await loadTsxModule(hookPath, {
        react: { useEffect: (effect, dependencies) => effects.push({ effect, dependencies }) },
        axios,
        './startPisRevealPolling': {
            startPisRevealPolling: (options) => {
                calls.push(['start', options]);
                return cleanup;
            },
        },
    }, {
        Date: { now: () => 123 },
        setInterval: (callback, delay) => {
            calls.push(['schedule', callback, delay]);
            return 42;
        },
        clearInterval: (id) => calls.push(['clear', id]),
    });
    const setters = {
        setQuestions: () => {}, setQuestionsAvailable: () => {}, setRevealAt: () => {},
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
    const tick = () => {};
    assert.equal(polling.scheduleInterval(tick, 1000), 42);
    polling.clearScheduledInterval(42);
    cleanup();
    assert.deepEqual(calls.slice(2), [
        ['schedule', tick, 1000], ['clear', 42], ['cleanup'],
    ]);
});
