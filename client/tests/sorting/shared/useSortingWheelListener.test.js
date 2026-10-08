import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadTsxModule } from '../../helpers/loadTsxComponent.js';

const hookPath = fileURLToPath(new URL('../../../src/features/sorting/useSortingWheelListener.js', import.meta.url));

// Load hook with injected dependencies for isolated tests.
async function loadHook() {
    const effects = [];
    const module = await loadTsxModule(hookPath, {
        react: { useEffect:
            /* Capture effects so the test can run them explicitly. */
            (effect, dependencies) => effects.push({ effect, dependencies }) },
    });
    return { useSortingWheelListener: module.useSortingWheelListener, effects };
}

test('wheel listener waits for the canvas and binds only on loading transitions', async () => {
    // Verify wheel listener waits for the canvas and binds only on loading transitions.
    const { useSortingWheelListener, effects } = await loadHook();
    const canvasRef = { current: null };
    // Provide an inert handle wheel stub for this test.
    const handleWheel = () => {};

    useSortingWheelListener(canvasRef, handleWheel, true);
    assert.deepEqual(Array.from(effects[0].dependencies), [true]);
    assert.equal(effects[0].effect(), undefined);

    const calls = [];
    canvasRef.current = {
        // Record add event listener calls for assertions.
        addEventListener: (...args) => calls.push(['add', ...args]),
        // Record remove event listener calls for assertions.
        removeEventListener: (...args) => calls.push(['remove', ...args]),
    };
    useSortingWheelListener(canvasRef, handleWheel, false);
    assert.deepEqual(Array.from(effects[1].dependencies), [false]);
    useSortingWheelListener(canvasRef, /* Leave this mocked callback inert. */ () => {}, false);
    assert.deepEqual(Array.from(effects[2].dependencies), Array.from(effects[1].dependencies));
    const cleanup = effects[1].effect();
    cleanup();

    assert.equal(calls.length, 2);
    assert.equal(calls[0][0], 'add');
    assert.equal(calls[0][1], 'wheel');
    assert.equal(calls[0][2], handleWheel);
    assert.equal(calls[0][3].passive, false);
    assert.deepEqual(calls[1], ['remove', 'wheel', handleWheel]);
});
