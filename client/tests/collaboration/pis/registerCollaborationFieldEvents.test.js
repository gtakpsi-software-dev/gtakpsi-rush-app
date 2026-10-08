import assert from 'node:assert/strict';
import test from 'node:test';

import { registerCollaborationFieldEvents } from '../../../src/features/pis/registerCollaborationFieldEvents.js';

// Create isolated state, dependency fakes, and captured calls for this test.
function setup() {
    const handlers = new Map();
    const updates = [];
    const socket = { on: /* Invoke handlers.set with the test inputs. */ (name, handler) => handlers.set(name, handler) };
    const knownVersionsRef = { current: {} };
    let connectedUsers = [
        { id: 'me', cursor: null, field: null },
        { id: 'other', cursor: null, field: null },
    ];
    let typingUsers = new Map();
    let documentState = null;
    let documentVersions = null;

    registerCollaborationFieldEvents({
        socket,
        currentUser: { id: 'me' },
        knownVersionsRef,
        // Update connectedUsers in the test harness.
        setConnectedUsers: (update) => { connectedUsers = update(connectedUsers); },
        // Update typingUsers in the test harness.
        setTypingUsers: (update) => { typingUsers = update(typingUsers); },
        // Record document-value updates and store the new state.
        setDocumentState: (value) => { updates.push('values'); documentState = value; },
        // Record version updates and store the new version map.
        setDocumentVersions: (value) => { updates.push('versions'); documentVersions = value; },
    });

    return {
        handlers, updates, knownVersionsRef,
        // Return connected users to the caller.
        getConnectedUsers: () => connectedUsers,
        // Return typing users to the caller.
        getTypingUsers: () => typingUsers,
        // Return document state to the caller.
        getDocumentState: () => documentState,
        // Return document versions to the caller.
        getDocumentVersions: () => documentVersions,
    };
}

test('field listeners ignore local presence echoes and apply remote cursor and typing state', () => {
    // Verify field listeners ignore local presence echoes and apply remote cursor and typing state.
    const state = setup();
    assert.deepEqual([...state.handlers.keys()], [
        'cursor-position', 'typing-indicator', 'document-state',
    ]);
    const initialUsers = state.getConnectedUsers();
    const initialTyping = state.getTypingUsers();

    state.handlers.get('cursor-position')({
        userId: 'me', field: 'answer', position: 3, timestamp: 100,
    });
    state.handlers.get('typing-indicator')({
        userId: 'me', field: 'answer', isTyping: true,
    });
    assert.equal(state.getConnectedUsers(), initialUsers);
    assert.equal(state.getTypingUsers(), initialTyping);

    state.handlers.get('cursor-position')({
        userId: 'other', field: 'answer', position: 5, timestamp: 100,
    });
    state.handlers.get('typing-indicator')({
        userId: 'other', userName: 'Grace', field: 'answer', isTyping: true,
    });
    assert.deepEqual(state.getConnectedUsers()[1], {
        id: 'other', cursor: 5, field: 'answer', cursorTimestamp: 100,
    });
    assert.equal(state.getTypingUsers().get('other-answer').userName, 'Grace');

    state.handlers.get('typing-indicator')({
        userId: 'other', field: 'answer', isTyping: false,
    });
    assert.equal(state.getTypingUsers().size, 0);
});

test('document snapshots update values, versions, and the known-version ref in order', () => {
    // Verify document snapshots update values, versions, and the known-version ref in order.
    const state = setup();
    state.handlers.get('document-state')({
        answer: { value: 'yes', version: 4 },
        legacy: 'old',
    });

    assert.deepEqual(state.updates, ['values', 'versions']);
    assert.deepEqual(state.getDocumentState(), { answer: 'yes', legacy: 'old' });
    assert.deepEqual(state.getDocumentVersions(), { answer: 4, legacy: 0 });
    assert.equal(state.knownVersionsRef.current, state.getDocumentVersions());
});
