import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadTsxModule } from './helpers/loadTsxComponent.js';

const hookPath = fileURLToPath(new URL('../src/features/sorting/useSortingWheelListener.js', import.meta.url));

async function loadHook() {
    const effects = [];
    const module = await loadTsxModule(hookPath, {
        react: { useEffect: (effect, dependencies) => effects.push({ effect, dependencies }) },
    });
    return { useSortingWheelListener: module.useSortingWheelListener, effects };
}

test('wheel listener waits for the canvas and binds only on loading transitions', async () => {
    const { useSortingWheelListener, effects } = await loadHook();
    const canvasRef = { current: null };
    const handleWheel = () => {};

    useSortingWheelListener(canvasRef, handleWheel, true);
    assert.deepEqual(Array.from(effects[0].dependencies), [true]);
    assert.equal(effects[0].effect(), undefined);

    const calls = [];
    canvasRef.current = {
        addEventListener: (...args) => calls.push(['add', ...args]),
        removeEventListener: (...args) => calls.push(['remove', ...args]),
    };
    useSortingWheelListener(canvasRef, handleWheel, false);
    assert.deepEqual(Array.from(effects[1].dependencies), [false]);
    const cleanup = effects[1].effect();
    cleanup();

    assert.equal(calls.length, 2);
    assert.equal(calls[0][0], 'add');
    assert.equal(calls[0][1], 'wheel');
    assert.equal(calls[0][2], handleWheel);
    assert.equal(calls[0][3].passive, false);
    assert.deepEqual(calls[1], ['remove', 'wheel', handleWheel]);
});
