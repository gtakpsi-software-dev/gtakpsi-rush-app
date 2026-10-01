const assert = require('node:assert/strict');
const test = require('node:test');
const { transformOperation, applyOperation } = require('../src/operations/legacyText');

test('transforms preserve insertion ties, deletion clamping, and untouched operations', () => {
    const operation = { type: 'insert', position: 4, content: 'B' };
    assert.deepEqual(transformOperation({ type: 'insert', position: 4, content: 'ABC' }, operation), {
        ...operation, position: 7,
    });
    assert.deepEqual(transformOperation({ type: 'delete', position: 2, length: 8 }, operation), {
        ...operation, position: 2,
    });
    assert.equal(transformOperation({ type: 'insert', position: 5, content: 'ABC' }, operation), operation);
    assert.equal(transformOperation({ type: 'replace', position: 0, length: 3 }, operation), operation);
});

test('legacy text operations preserve insert, delete, and replace offsets', () => {
    assert.equal(applyOperation('abcd', { type: 'insert', position: 2, content: 'X' }), 'abXcd');
    assert.equal(applyOperation('abcd', { type: 'delete', position: 1, length: 2 }), 'ad');
    assert.equal(applyOperation('abcd', { type: 'replace', position: 1, length: 2, content: 'XY' }), 'aXYd');
});

test('missing operation values and unknown types retain the existing text', () => {
    assert.equal(applyOperation('abcd', { type: 'insert', position: 2 }), 'abcd');
    assert.equal(applyOperation('abcd', { type: 'delete', position: 1 }), 'abcd');
    assert.equal(applyOperation('abcd', { type: 'replace', position: 1 }), 'abcd');
    assert.equal(applyOperation('abcd', { type: 'unknown', position: 0, content: 'X' }), 'abcd');
});
