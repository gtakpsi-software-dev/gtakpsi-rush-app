import assert from 'node:assert/strict';
import test from 'node:test';

import { registerCollaborationTextEvents } from '../../../src/features/pis/registerCollaborationTextEvents.js';

// Create isolated state, dependency fakes, and captured calls for this test.
function setup(initialUpdates = [], initialOperations = []) {
    const handlers = new Map();
    const emitted = [];
    const socket = {
        // Invoke handlers.set with the test inputs.
        on: (name, handler) => handlers.set(name, handler),
        // Record emit calls for assertions.
        emit: (name, payload) => emitted.push([name, payload]),
    };
    const knownVersionsRef = { current: {} };
    const pendingUpdatesRef = { current: {} };
    const resendingFieldsRef = { current: new Set() };
    let remoteUpdates = initialUpdates;
    let remoteOperations = initialOperations;

    registerCollaborationTextEvents({
        socket,
        socketRef: { current: socket },
        currentUser: { id: 'me', firstName: 'Ada', lastName: 'Lovelace' },
        knownVersionsRef,
        pendingUpdatesRef,
        resendingFieldsRef,
        // Update remoteOperations in the test harness.
        setRemoteOperations: (update) => { remoteOperations = update(remoteOperations); },
        // Update remoteUpdates in the test harness.
        setRemoteUpdates: (update) => { remoteUpdates = update(remoteUpdates); },
    });

    return {
        handlers, emitted, knownVersionsRef, pendingUpdatesRef,
        resendingFieldsRef,
        // Return remote operations to the caller.
        getRemoteOperations: () => remoteOperations,
        // Return remote updates to the caller.
        getRemoteUpdates: () => remoteUpdates,
    };
}

test('registers text listeners in order and bounds accepted remote history', () => {
    // Verify registers text listeners in order and bounds accepted remote history.
    const initial = Array.from({ length: 100 }, /* Return the fixture for this scenario. */ (_, index) => ({ field: 'old', value: index }));
    const state = setup(initial);
    assert.deepEqual([...state.handlers.keys()], [
        'text-operation', 'text-update', 'text-ack', 'text-reject',
    ]);

    state.handlers.get('text-update')({ field: 'answer', userId: 'me', value: 'self', version: 1 });
    assert.equal(state.getRemoteUpdates(), initial);

    const update = { field: 'answer', userId: 'other', value: 'new', version: 2 };
    state.handlers.get('text-update')(update);
    assert.equal(state.getRemoteUpdates().length, 100);
    assert.equal(state.getRemoteUpdates()[0], initial[1]);
    assert.deepEqual(state.getRemoteUpdates().at(-1), update);
    assert.equal(state.knownVersionsRef.current.answer, 2);
});

test('ignores self and duplicate operations while retaining the latest 50', () => {
    // Verify ignores self and duplicate operations while retaining the latest 50.
    const initial = Array.from({ length: 50 }, /* Return the fixture for this scenario. */ (_, index) => ({
        id: `operation-${index}`, userId: 'other',
    }));
    const state = setup([], initial);

    state.handlers.get('text-operation')({ id: 'self', userId: 'me' });
    state.handlers.get('text-operation')({ id: 'operation-49', userId: 'other' });
    assert.equal(state.getRemoteOperations(), initial);

    const next = { id: 'operation-50', userId: 'other' };
    state.handlers.get('text-operation')(next);
    assert.equal(state.getRemoteOperations().length, 50);
    assert.equal(state.getRemoteOperations()[0], initial[1]);
    assert.equal(state.getRemoteOperations().at(-1), next);
});

test('rejected local text rebases, resends, and clears after matching acknowledgement', () => {
    // Verify rejected local text rebases, resends, and clears after matching acknowledgement.
    const state = setup();
    state.pendingUpdatesRef.current.answer = { clientUpdateId: 'old', value: 'local' };

    state.handlers.get('text-reject')({
        field: 'answer', serverValue: 'remote', serverVersion: 5, clientUpdateId: 'old',
    });
    assert.equal(state.emitted.length, 1);
    assert.equal(state.emitted[0][0], 'text-update');
    assert.deepEqual({ ...state.emitted[0][1], clientUpdateId: 'new' }, {
        field: 'answer', value: 'local', baseVersion: 5, clientUpdateId: 'new',
        userId: 'me', userName: 'Ada Lovelace',
    });
    const newId = state.emitted[0][1].clientUpdateId;
    assert.equal(state.pendingUpdatesRef.current.answer.clientUpdateId, newId);
    assert.equal(state.resendingFieldsRef.current.has('answer'), true);
    assert.deepEqual(state.getRemoteUpdates(), []);

    state.handlers.get('text-ack')({ field: 'answer', version: 6, clientUpdateId: newId });
    assert.equal(state.knownVersionsRef.current.answer, 6);
    assert.equal(state.pendingUpdatesRef.current.answer, undefined);
    assert.equal(state.resendingFieldsRef.current.has('answer'), false);
});

test('unmatched rejection exposes the server value as a remote update', () => {
    // Verify unmatched rejection exposes the server value as a remote update.
    const state = setup();
    state.pendingUpdatesRef.current.answer = { clientUpdateId: 'new', value: 'local' };

    state.handlers.get('text-reject')({
        field: 'answer', serverValue: 'remote', serverVersion: 7, clientUpdateId: 'old',
    });
    assert.deepEqual(state.getRemoteUpdates(), [{
        field: 'answer', value: 'remote', version: 7, userId: 'server',
    }]);
    assert.deepEqual(state.pendingUpdatesRef.current.answer, {
        clientUpdateId: 'new', value: 'local',
    });
    assert.deepEqual(state.emitted, []);
});
