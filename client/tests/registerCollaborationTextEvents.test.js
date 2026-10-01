import assert from 'node:assert/strict';
import test from 'node:test';

import { registerCollaborationTextEvents } from '../src/features/pis/registerCollaborationTextEvents.js';

function setup(initialUpdates = []) {
    const handlers = new Map();
    const emitted = [];
    const socket = {
        on: (name, handler) => handlers.set(name, handler),
        emit: (name, payload) => emitted.push([name, payload]),
    };
    const knownVersionsRef = { current: {} };
    const pendingUpdatesRef = { current: {} };
    const resendingFieldsRef = { current: new Set() };
    let remoteUpdates = initialUpdates;

    registerCollaborationTextEvents({
        socket,
        socketRef: { current: socket },
        currentUser: { id: 'me', firstName: 'Ada', lastName: 'Lovelace' },
        knownVersionsRef,
        pendingUpdatesRef,
        resendingFieldsRef,
        setRemoteUpdates: (update) => { remoteUpdates = update(remoteUpdates); },
    });

    return {
        handlers, emitted, knownVersionsRef, pendingUpdatesRef,
        resendingFieldsRef, getRemoteUpdates: () => remoteUpdates,
    };
}

test('registers text listeners in order and bounds accepted remote history', () => {
    const initial = Array.from({ length: 100 }, (_, index) => ({ field: 'old', value: index }));
    const state = setup(initial);
    assert.deepEqual([...state.handlers.keys()], ['text-update', 'text-ack', 'text-reject']);

    state.handlers.get('text-update')({ field: 'answer', userId: 'me', value: 'self', version: 1 });
    assert.equal(state.getRemoteUpdates(), initial);

    const update = { field: 'answer', userId: 'other', value: 'new', version: 2 };
    state.handlers.get('text-update')(update);
    assert.equal(state.getRemoteUpdates().length, 100);
    assert.equal(state.getRemoteUpdates()[0], initial[1]);
    assert.deepEqual(state.getRemoteUpdates().at(-1), update);
    assert.equal(state.knownVersionsRef.current.answer, 2);
});

test('rejected local text rebases, resends, and clears after matching acknowledgement', () => {
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
