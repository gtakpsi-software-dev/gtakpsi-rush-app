import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import { transformWithEsbuild } from 'vite';

const hookPath = fileURLToPath(new URL('../../../src/features/pis/usePisAutosave.js', import.meta.url));

// Load hook with injected dependencies for isolated tests.
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
            // Keep the callback callable without a React render cycle.
            useCallback: (callback) => callback,
            // Capture effects so the test can run them explicitly.
            useEffect: (effect, dependencies) => effects.push({ effect, dependencies }),
        },
        './performPisAutosave': {
            // Record perform pis autosave calls for assertions.
            performPisAutosave: (args) => calls.push(args),
        },
    };
    runInNewContext(code, {
        module,
        exports: module.exports,
        // Store autosave callbacks and return deterministic timer IDs.
        setTimeout(callback, delay) {
            const id = ++nextTimerId;
            timers.set(id, { callback, delay });
            return id;
        },
        // Invoke timers.delete with the test inputs.
        clearTimeout: (id) => timers.delete(id),
        // Resolve injected test dependencies before falling back to real modules.
        require(specifier) {
            return Object.hasOwn(dependencies, specifier)
                ? dependencies[specifier]
                : requireFromHook(specifier);
        },
    }, { filename: hookPath });
    return { usePisAutosave: module.exports.usePisAutosave, effects, timers, calls };
}

test('PIS autosave waits for the initial load, then debounces changes and cleans up', async () => {
    // Verify PIS autosave waits for the initial load, then debounces changes and cleans up.
    const { usePisAutosave, effects, timers, calls } = await loadHook();
    const initialLoad = { current: true };
    const timeout = { current: null };
    const questions = [{ question: 'Prompt' }];
    const answers = { Prompt: 'First' };
    // Provide an inert set save status stub for this test.
    const setSaveStatus = () => {};
    // Provide an inert set last saved stub for this test.
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
    assert.deepEqual([...timers.values()].map(/* Return delay to the caller. */ ({ delay }) => delay), [1000]);
    [...timers.values()][0].callback();
    assert.equal(initialLoad.current, false);

    timers.clear();
    effects.length = 0;
    const changedAnswers = { Prompt: 'Updated' };
    usePisAutosave({ ...args, loading: false, answers: changedAnswers });
    const cleanup = effects[0].effect();
    assert.deepEqual([...timers.values()].map(/* Return delay to the caller. */ ({ delay }) => delay), [2000]);
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
