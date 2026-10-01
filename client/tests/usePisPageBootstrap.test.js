import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadTsxModule } from './helpers/loadTsxComponent.js';

const hookPath = fileURLToPath(new URL('../src/features/pis/usePisPageBootstrap.js', import.meta.url));

test('PIS bootstrap retains its loading gate, request inputs, and effect dependencies', async () => {
    const effects = [];
    const calls = [];
    const verifyUser = () => {};
    const navigate = () => {};
    const auth = { currentUser: { id: 'brother' } };
    const axios = { get: (...args) => calls.push(['get', ...args]) };
    const setters = Object.fromEntries([
        'setCurrentUser', 'setRushee', 'setAnswers', 'setBrotherA', 'setBrotherB',
        'setQuestions', 'setQuestionsAvailable', 'setRevealAt', 'setLoading',
    ].map((name) => [name, () => {}]));
    const { usePisPageBootstrap } = await loadTsxModule(hookPath, {
        react: { useEffect: (effect, dependencies) => effects.push({ effect, dependencies }) },
        axios,
        '../auth/verifyUser': { verifyUser },
        '../../firebase': { auth },
        './loadPisPageData': { loadPisPageData: (options) => calls.push(['load', options]) },
    }, {
        localStorage: { getItem: () => 'stored-user' },
        console: { log: () => {} },
    });
    const options = {
        navigate, api: '/api', gtid: '123', currentUser: null, ...setters,
    };

    usePisPageBootstrap({ ...options, loading: false });
    effects[0].effect();
    assert.deepEqual(calls, []);

    usePisPageBootstrap({ ...options, loading: true });
    effects[1].effect();
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'load');
    assert.deepEqual(Array.from(effects[1].dependencies), [true, '/api', '123', navigate]);

    const loaded = calls[0][1];
    assert.equal(loaded.verifyUser, verifyUser);
    assert.equal(loaded.navigate, navigate);
    assert.equal(loaded.auth, auth);
    assert.equal(loaded.currentUser, null);
    assert.equal(loaded.errorTitle, 'Default Error Title');
    assert.equal(loaded.errorDescription, 'Default Error Description');
    assert.equal(loaded.getStoredUser(), 'stored-user');
    assert.equal(loaded.api, '/api');
    assert.equal(loaded.gtid, '123');
    loaded.get('/api/rushee/123');
    assert.deepEqual(calls[1], ['get', '/api/rushee/123']);
    for (const [name, setter] of Object.entries(setters)) {
        assert.equal(loaded[name], setter);
    }
});
