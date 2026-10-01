import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import { transformWithEsbuild } from 'vite';

const hookPath = fileURLToPath(new URL('../src/features/pis/usePisAutosave.js', import.meta.url));

async function loadHook() {
    const effects = [];
    const timers = new Map();
    const calls = [];
    let nextTimerId = 0;
    const source = await readFile(hookPath, 'utf8');
    const { code } = await transformWithEsbuild(source, hookPath, {
        loader: 'js', format: 'cjs',
    });
    const module = { exports: {} };
    const requireFromHook = createRequire(hookPath);
    const dependencies = {
        react: {
            useCallback: (callback) => callback,
            useEffect: (effect, dependencies) => effects.push({ effect, dependencies }),
        },
        './performPisAutosave': {
            performPisAutosave: (args) => calls.push(args),
        },
    };
    runInNewContext(code, {
        module,
        exports: module.exports,
        setTimeout(callback, delay) {
            const id = ++nextTimerId;
            timers.set(id, { callback, delay });
            return id;
        },
        clearTimeout: (id) => timers.delete(id),
        require(specifier) {
            return Object.hasOwn(dependencies, specifier)
                ? dependencies[specifier]
                : requireFromHook(specifier);
        },
    }, { filename: hookPath });
    return { usePisAutosave: module.exports.usePisAutosave, effects, timers, calls };
}

test('PIS autosave waits for the initial load, then debounces changes and cleans up', async () => {
    const { usePisAutosave, effects, timers, calls } = await loadHook();
    const initialLoad = { current: true };
    const timeout = { current: null };
    const questions = [{ question: 'Prompt' }];
    const answers = { Prompt: 'First' };
    const setSaveStatus = () => {};
    const setLastSaved = () => {};
    const args = {
        questions, answers, brotherA: { firstName: 'Ada' }, brotherB: {},
        gtid: '123', api: '/api', axios: {}, setSaveStatus, setLastSaved,
        loading: true, isInitialLoadRef: initialLoad, autosaveTimeoutRef: timeout,
    };

    usePisAutosave(args);
    assert.equal(effects.length, 2);
    effects[0].effect();
    effects[1].effect();
    assert.equal(timers.size, 0);

    effects.length = 0;
    usePisAutosave({ ...args, loading: false });
    effects[0].effect();
    assert.equal(timers.size, 0);
    effects[1].effect();
    assert.deepEqual([...timers.values()].map(({ delay }) => delay), [1000]);
    [...timers.values()][0].callback();
    assert.equal(initialLoad.current, false);

    timers.clear();
    effects.length = 0;
    const changedAnswers = { Prompt: 'Updated' };
    usePisAutosave({ ...args, loading: false, answers: changedAnswers });
    const cleanup = effects[0].effect();
    assert.deepEqual([...timers.values()].map(({ delay }) => delay), [2000]);
    const saveTimer = timeout.current;
    cleanup();
    assert.equal(timers.has(saveTimer), false);

    effects.length = 0;
    const finalAnswers = { Prompt: 'Final' };
    usePisAutosave({ ...args, loading: false, answers: finalAnswers });
    const finalCleanup = effects[0].effect();
    assert.equal(calls.length, 0);
    const finalTimer = timeout.current;
    timers.get(finalTimer).callback();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].answers, finalAnswers);
    assert.equal(calls[0].questions, questions);
    assert.equal(calls[0].gtid, '123');
    assert.equal(calls[0].setSaveStatus, setSaveStatus);
    assert.equal(calls[0].setLastSaved, setLastSaved);
    finalCleanup();
    assert.equal(timers.has(finalTimer), false);
});
