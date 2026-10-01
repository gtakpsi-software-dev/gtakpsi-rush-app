const assert = require('node:assert/strict');
const test = require('node:test');

const { parseTextUpdate } = require('../src/handlers/parseTextUpdate');

test('complete text updates keep their field, string value, and version', () => {
    assert.deepEqual(parseTextUpdate({
        field: 'notes', value: 'Hello', baseVersion: 2, clientUpdateId: 'edit-1',
    }), {
        field: 'notes', value: 'Hello', baseVersion: 2, clientUpdateId: 'edit-1',
    });
});

test('missing fields or the wrong version and update ID types remain ignored', () => {
    for (const payload of [
        null,
        {},
        { field: '', baseVersion: 0, clientUpdateId: 'edit-1' },
        { field: 'notes', baseVersion: '0', clientUpdateId: 'edit-1' },
        { field: 'notes', baseVersion: 0, clientUpdateId: 3 },
        { field: 'notes', baseVersion: 0, clientUpdateId: '' },
    ]) {
        assert.equal(parseTextUpdate(payload), null);
    }
});

test('non-string values remain empty and other accepted types are not newly rejected', () => {
    assert.deepEqual(parseTextUpdate({
        field: 7, value: 123, baseVersion: Number.NaN, clientUpdateId: 'edit-2',
    }), {
        field: 7, value: '', baseVersion: Number.NaN, clientUpdateId: 'edit-2',
    });
});
