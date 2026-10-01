import assert from 'node:assert/strict';
import test from 'node:test';

import {
    formatTimeslot,
    groupTimeslots,
    selectAllTimeslots,
    sortTimeslots,
    timeslotIso
} from '../src/features/brotherPisAvailability/timeslots.js';

const slot = (date) => ({ time: { $date: { $numberLong: String(date.getTime()) } } });
const early = slot(new Date(2030, 0, 1, 9, 15));
const late = slot(new Date(2030, 0, 1, 13, 30));
const nextDay = slot(new Date(2030, 0, 2, 10, 0));

test('timeslot sorting is chronological and retains the API payload array', () => {
    const payload = [late, nextDay, early];
    assert.equal(sortTimeslots(payload), payload);
    assert.deepEqual(payload, [early, late, nextDay]);
});

test('selection uses ISO values and deduplicates repeated slots', () => {
    assert.equal(timeslotIso(early), new Date(2030, 0, 1, 9, 15).toISOString());
    assert.deepEqual([...selectAllTimeslots([early, early, late])], [timeslotIso(early), timeslotIso(late)]);
});

test('local labels and date groups preserve the modal display order', () => {
    assert.deepEqual(formatTimeslot(late), { date: 'Tue, Jan 1', time: '1:30 PM' });
    assert.deepEqual(groupTimeslots([early, late, nextDay]), {
        'Tuesday, January 1': [early, late],
        'Wednesday, January 2': [nextDay]
    });
});
