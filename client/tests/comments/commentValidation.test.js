import assert from 'node:assert/strict';
import test from 'node:test';
import {
    checkSpeculativeLanguage,
    checkRusheeName,
    validateComment,
    generateWarnings,
} from '../../src/features/comments/commentValidation.js';

test('speculation uses whole words, bank order, and deduplicated matches', () => {
    // Verify speculation uses whole words, bank order, and deduplicated matches.
    assert.deepEqual(checkSpeculativeLanguage('Eventually they COULD be a good fit, eventually.'), {
        hasSpeculativeLanguage: true,
        flaggedWords: ['could', 'eventually', 'good fit'],
    });
    assert.deepEqual(checkSpeculativeLanguage('The mayor discussed the billboard.'), {
        hasSpeculativeLanguage: false,
        flaggedWords: [],
    });
});

test('empty and non-string comments have no speculative matches', () => {
    // Verify empty and non-string comments have no speculative matches.
    for (const comment of ['', null, undefined, 42, {}]) {
        assert.deepEqual(checkSpeculativeLanguage(comment), {
            hasSpeculativeLanguage: false,
            flaggedWords: [],
        });
    }
});

test('name detection preserves original capitalization and includes the full name', () => {
    // Verify name detection preserves original capitalization and includes the full name.
    assert.deepEqual(checkRusheeName('JOHN SMITH met Johnny.', 'John', 'Smith'), {
        hasRusheeName: true,
        foundNames: ['John', 'Smith', 'John Smith'],
    });
    assert.deepEqual(checkRusheeName('Johnny Smithson', 'John', 'Smith'), {
        hasRusheeName: false,
        foundNames: [],
    });
});

test('name detection requires both names, even when the first name is present', () => {
    // Verify name detection requires both names, even when the first name is present.
    assert.deepEqual(checkRusheeName('John attended.', 'John', ''), {
        hasRusheeName: false,
        foundNames: [],
    });
});

test('validation preserves warning text and speculative-before-name ordering', () => {
    // Verify validation preserves warning text and speculative-before-name ordering.
    const result = validateComment('John could contribute.', 'John', 'Smith');
    assert.equal(result.hasWarnings, true);
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(generateWarnings(result), [
        {
            type: 'speculative',
            message: 'Speculative language detected: "could". Consider using more concrete observations.',
        },
        {
            type: 'name',
            message: 'Rushee\'s name detected: "John". Consider using "the rushee" or "they" instead.',
        },
    ]);
    assert.deepEqual(generateWarnings(validateComment('Discussed their internship.', 'John', 'Smith')), []);
});
