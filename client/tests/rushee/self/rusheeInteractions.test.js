import assert from 'node:assert/strict';
import test from 'node:test';
import { nightMatches, mergeRushNights, computeInteractionsByNight, formatNightInteractionLine } from '../../../src/features/rushee/interactions.js';

test('nights match by normalized name or Eastern calendar day across UTC midnight', () => {
    assert.equal(nightMatches({ name: ' NIGHT 1 ' }, { name: 'Night 1' }), true);
    assert.equal(nightMatches(
        { name: 'A', time: { $date: '2026-09-09T23:00:00Z' } },
        { name: 'B', time: '2026-09-10T01:00:00Z' },
    ), true);
    assert.equal(nightMatches(
        { name: 'A', time: '2026-09-09T23:00:00Z' },
        { name: 'B', time: '2026-09-10T05:00:00Z' },
    ), false);
    assert.equal(nightMatches(null, { name: 'Night 1' }), false);
});

test('merging retains database dates, supplements canonical and comment nights, and sorts without mutation', () => {
    const nights = [{ name: 'Night 1', time: '2026-09-08T23:00:00Z' }];
    const comments = [{ night: { name: 'Extra', time: '2026-09-20T23:00:00Z' } }];
    const result = mergeRushNights(nights, comments);
    assert.deepEqual(result.map(({ name }) => name), ['Night 1', 'Night 2', 'Closed Night', 'Extra']);
    assert.equal(result[0].time, nights[0].time);
    assert.equal(nights.length, 1);
    assert.equal(comments.length, 1);
});

test('interactions count distinct brothers and require attendance except for development nights', () => {
    const dev = { name: 'Dev Night', time: '2026-09-01T23:00:00Z' };
    const night = { name: 'Night 1', time: '2026-09-09T23:00:00Z' };
    const comments = [
        { brother_name: 'A', night }, { brother_name: 'A', night },
        { brother_name: 'B', night }, { brother_name: 'A', night: dev },
    ];
    assert.deepEqual(computeInteractionsByNight([dev], [night], comments), [
        { night_index: 1, name: 'Dev Night', interactions: 1 },
        { night_index: 2, name: 'Night 1', interactions: 2 },
        { night_index: 3, name: 'Night 2', interactions: null },
        { night_index: 4, name: 'Closed Night', interactions: null },
    ]);
    assert.equal(computeInteractionsByNight([], [], comments)[1].interactions, null);
});

test('interaction labels distinguish absence from zero interactions', () => {
    assert.equal(formatNightInteractionLine({ name: 'Night 1', interactions: null }), 'Night 1: N/A');
    assert.equal(formatNightInteractionLine({ night_index: 2, interactions: 0 }), 'Night 2: Interactions: 0');
});
