const assert = require('node:assert/strict');
const test = require('node:test');
const { applyVersionedTextUpdate } = require('../src/operations/versionedText');

function room() {
    return {
        document: new Map([['notes', 'Before']]),
        versions: new Map([['notes', 2]]),
        lastActivity: 'before',
    };
}

test('accepted full-text updates replace only their field and advance its version', () => {
    const state = room();
    state.document.set('other', 'Unchanged');
    state.versions.set('other', 4);

    const result = applyVersionedTextUpdate(state, {
        field: 'notes', value: 'After', baseVersion: 2,
    });

    assert.deepEqual(result, { accepted: true, version: 3 });
    assert.deepEqual([...state.document], [['notes', 'After'], ['other', 'Unchanged']]);
    assert.deepEqual([...state.versions], [['notes', 3], ['other', 4]]);
    assert.ok(Number.isFinite(Date.parse(state.lastActivity)));
});

test('stale updates return server truth without mutating room state or activity', () => {
    const state = room();

    const result = applyVersionedTextUpdate(state, {
        field: 'notes', value: 'Stale', baseVersion: 1,
    });

    assert.deepEqual(result, {
        accepted: false, serverValue: 'Before', serverVersion: 2,
    });
    assert.deepEqual([...state.document], [['notes', 'Before']]);
    assert.deepEqual([...state.versions], [['notes', 2]]);
    assert.equal(state.lastActivity, 'before');
});

test('unversioned fields use version zero and missing text rejects as empty', () => {
    const state = room();
    state.versions.set('legacy', 0);

    assert.deepEqual(applyVersionedTextUpdate(state, {
        field: 'legacy', value: 'New', baseVersion: 1,
    }), { accepted: false, serverValue: '', serverVersion: 0 });
    assert.deepEqual(applyVersionedTextUpdate(state, {
        field: 'legacy', value: 'New', baseVersion: 0,
    }), { accepted: true, version: 1 });
    assert.equal(state.document.get('legacy'), 'New');
    assert.equal(state.versions.get('legacy'), 1);
});
