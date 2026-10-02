import assert from 'node:assert/strict';
import test from 'node:test';

import { submitAvailability } from '../../src/features/brotherPisAvailability/submitAvailability.js';

function harness(overrides = {}) {
    const calls = [];
    const deps = {
        user: { uid: 'brother-1', email: 'ada@example.edu', displayName: ' Ada Example ' },
        selectedSlots: new Set(),
        api: '/api',
        axios: {
            post: async (url, payload) => {
                calls.push(['post', url, payload]);
                return { data: { status: 'success' } };
            }
        },
        toast: {
            error: (message) => calls.push(['error', message]),
            success: (message) => calls.push(['success', message])
        },
        onSubmit: () => calls.push(['onSubmit']),
        setSubmitting: (value) => calls.push(['submitting', value]),
        logError: (...args) => calls.push(['log', ...args]),
        ...overrides
    };
    return { calls, deps };
}

test('display name fallback and zero-slot submission retain payload and event order', async () => {
    const { calls, deps } = harness();
    await submitAvailability(deps);

    assert.deepEqual(calls, [
        ['submitting', true],
        ['post', '/api/brother/pis-availability/submit', {
            brother_uid: 'brother-1',
            brother_email: 'ada@example.edu',
            brother_first_name: 'Ada',
            brother_last_name: 'Example',
            available_timeslots: []
        }],
        ['success', 'Availability submitted successfully!'],
        ['onSubmit'],
        ['submitting', false]
    ]);
});

test('explicit name fields and selected ISO values retain precedence and order', async () => {
    const { calls, deps } = harness({
        user: {
            uid: 'brother-1', email: 'ada@example.edu',
            firstName: ' Grace ', lastname: ' Hopper ', displayName: 'Ada Example'
        },
        selectedSlots: new Set(['2030-01-01T14:00:00.000Z', '2030-01-02T15:00:00.000Z'])
    });
    await submitAvailability(deps);

    assert.equal(calls[1][2].brother_first_name, 'Grace');
    assert.equal(calls[1][2].brother_last_name, 'Hopper');
    assert.deepEqual(calls[1][2].available_timeslots, [
        '2030-01-01T14:00:00.000Z', '2030-01-02T15:00:00.000Z'
    ]);
});

test('missing last name stops before setting submission state or posting', async () => {
    const { calls, deps } = harness({ user: { displayName: 'Ada' } });
    await submitAvailability(deps);
    assert.deepEqual(calls, [['error', 'Unable to determine your name. Please contact an admin.']]);
});

test('server errors use their message or fallback and always clear submission state', async () => {
    for (const message of ['Try again', '']) {
        const { calls, deps } = harness({
            axios: { post: async () => ({ data: { status: 'error', message } }) }
        });
        await submitAvailability(deps);
        assert.deepEqual(calls, [
            ['submitting', true],
            ['error', message || 'Failed to submit'],
            ['submitting', false]
        ]);
    }
});

test('transport failure logs and toasts before clearing submission state', async () => {
    const failure = new Error('network down');
    const { calls, deps } = harness({ axios: { post: async () => { throw failure; } } });
    await submitAvailability(deps);
    assert.deepEqual(calls, [
        ['submitting', true],
        ['log', 'Failed to submit availability:', failure],
        ['error', 'Failed to submit availability'],
        ['submitting', false]
    ]);
});
