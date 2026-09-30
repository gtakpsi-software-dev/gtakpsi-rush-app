import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRatingValue, ratingBadgeClass } from '../src/js/ratingDisplay.js';

test('ratings preserve legacy zero labels, rounding, coercion, and fallback text', () => {
    for (const [value, expected] of [
        [0, 'Unsatisfactory'], ['0', 'Unsatisfactory'], [null, 'Unsatisfactory'],
        [1, '1/5'], [3.5, '4/5'], ['5', '5/5'], [6, '6'], ['unknown', 'unknown'],
    ]) {
        assert.equal(formatRatingValue(value), expected);
    }
});

test('badge colors retain existing threshold behavior for out-of-range ratings', () => {
    for (const [value, expected] of [
        [0, 'bg-red-100 text-red-700'], [2.9, 'bg-red-50 text-red-600'],
        [3, 'bg-apple-gray-100 text-apple-gray-700'], [3.9, 'bg-apple-gray-100 text-apple-gray-700'],
        ['4', 'bg-green-100 text-green-700'], [6, 'bg-green-100 text-green-700'],
        [undefined, 'bg-red-50 text-red-600'],
    ]) {
        assert.equal(ratingBadgeClass(value), expected);
    }
});
