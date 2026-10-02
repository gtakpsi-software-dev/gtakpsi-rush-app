import assert from 'node:assert/strict';
import test from 'node:test';

import { reconcileRemoteFieldUpdate } from '../../../src/features/collaboration/reconcileRemoteFieldUpdate.js';

function setup(overrides = {}) {
    const calls = [];
    const timers = [];
    const refs = {
        lastProcessedVersionRef: { current: 2 },
        lastLocalInputTimeRef: { current: 0 },
        processingRemoteOpRef: { current: false },
        pendingLocalChangeRef: { current: true },
        lastSentValueRef: { current: 'Old' },
    };
    const options = {
        remoteUpdates: [],
        fieldKey: 'notes',
        localValue: 'Old',
        ...refs,
        setLocalValue: (value) => calls.push(['state', value]),
        onRemoteChange: (value) => calls.push(['change', value]),
        deferMs: 500,
        now: () => 1000,
        setTimer: (callback, delay) => {
            const timer = { callback, delay };
            timers.push(timer);
            return timer;
        },
        clearTimer: (timer) => calls.push(['cancel', timer.delay]),
        ...overrides,
    };
    return { options, refs, calls, timers };
}

test('ignores unrelated and stale updates before reading the clock', () => {
    const { options, refs, calls, timers } = setup({
        remoteUpdates: [
            { field: 'other', value: 'New', version: 4 },
            { field: 'notes', value: 'Stale', version: 2 },
        ],
        now: () => { throw new Error('clock should not be read'); },
    });

    assert.equal(reconcileRemoteFieldUpdate(options), undefined);
    assert.equal(refs.lastProcessedVersionRef.current, 2);
    assert.deepEqual(calls, []);
    assert.deepEqual(timers, []);
});

test('matching latest value advances its version without notifying or scheduling', () => {
    const { options, refs, calls, timers } = setup({
        remoteUpdates: [
            { field: 'notes', value: 'Older', version: 3 },
            { field: 'other', value: 'Ignored', version: 9 },
            { field: 'notes', value: 'Old', version: 4 },
        ],
        now: () => { throw new Error('clock should not be read'); },
    });

    reconcileRemoteFieldUpdate(options);
    assert.equal(refs.lastProcessedVersionRef.current, 4);
    assert.deepEqual(calls, []);
    assert.deepEqual(timers, []);
});

test('applies the newest field update immediately after the typing window', () => {
    const { options, refs, calls, timers } = setup({
        remoteUpdates: [
            { field: 'notes', value: 'Older', version: 3 },
            { field: 'other', value: 'Ignored', version: 9 },
            { field: 'notes', value: 'Latest', version: 4 },
        ],
    });

    assert.equal(reconcileRemoteFieldUpdate(options), undefined);
    assert.deepEqual(calls, [['state', 'Latest'], ['change', 'Latest']]);
    assert.equal(refs.processingRemoteOpRef.current, true);
    assert.equal(refs.pendingLocalChangeRef.current, false);
    assert.equal(refs.lastSentValueRef.current, 'Latest');
    assert.equal(refs.lastProcessedVersionRef.current, 4);
    assert.deepEqual(timers.map((timer) => timer.delay), [0]);
    timers[0].callback();
    assert.equal(refs.processingRemoteOpRef.current, false);
});

test('defers a remote update for the field-specific typing window and cancels on cleanup', () => {
    const { options, refs, calls, timers } = setup({
        remoteUpdates: [{ field: 'notes', value: 'Remote', version: 0 }],
        deferMs: 650,
    });
    refs.lastLocalInputTimeRef.current = 900;

    const cleanup = reconcileRemoteFieldUpdate(options);
    assert.deepEqual(calls, []);
    assert.deepEqual(timers.map((timer) => timer.delay), [650]);
    cleanup();
    assert.deepEqual(calls, [['cancel', 650]]);
    assert.equal(refs.processingRemoteOpRef.current, false);
});

test('applies a deferred update when its timer fires', () => {
    const { options, refs, calls, timers } = setup({
        remoteUpdates: [{ field: 'notes', value: 'Remote', version: 0 }],
        deferMs: 650,
    });
    refs.lastLocalInputTimeRef.current = 900;

    reconcileRemoteFieldUpdate(options);
    timers[0].callback();
    assert.deepEqual(calls, [['state', 'Remote'], ['change', 'Remote']]);
    assert.equal(refs.lastProcessedVersionRef.current, 2);
    assert.equal(timers[1].delay, 0);
});
