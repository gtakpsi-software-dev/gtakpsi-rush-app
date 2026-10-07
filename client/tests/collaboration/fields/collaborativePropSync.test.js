import assert from 'node:assert/strict';
import test from 'node:test';

import { syncPropValue } from '../../../src/features/collaboration/syncPropValue.js';

function setup(overrides = {}) {
    const changes = [];
    const options = {
        value: 'Parent',
        localValue: 'Local',
        processingRemoteOpRef: { current: false },
        pendingLocalChangeRef: { current: false },
        lastSentValueRef: { current: 'Local' },
        setLocalValue: (value) => changes.push(value),
        ...overrides,
    };
    return { changes, options };
}

test('remote processing blocks a simultaneous prop overwrite', () => {
    const { changes, options } = setup({ processingRemoteOpRef: { current: true } });
    syncPropValue(options);
    assert.deepEqual(changes, []);
    assert.equal(options.lastSentValueRef.current, 'Local');
});

test('pending local typing waits for a matching parent echo', () => {
    const pendingLocalChangeRef = { current: true };
    const { changes, options } = setup({ pendingLocalChangeRef });
    syncPropValue(options);
    assert.deepEqual(changes, []);
    assert.equal(pendingLocalChangeRef.current, true);

    syncPropValue({ ...options, value: 'Local' });
    assert.deepEqual(changes, []);
    assert.equal(pendingLocalChangeRef.current, false);
});

test('a later prop value updates local text and the last-sent reference', () => {
    const { changes, options } = setup();
    syncPropValue(options);
    assert.deepEqual(changes, ['Parent']);
    assert.equal(options.lastSentValueRef.current, 'Parent');

    syncPropValue({ ...options, value: null });
    assert.deepEqual(changes, ['Parent', '']);
    assert.equal(options.lastSentValueRef.current, '');
});
