import assert from 'node:assert/strict';
import test from 'node:test';

import { filterBidCommitteeRushees } from '../../src/features/dashboard/bidCommitteeList.js';

const rushees = [
    { name: 'Zoe Alpha', gtid: '900000001', major: 'Business', class: '2028', registration_order: 3 },
    { name: 'Ada Gamma', gtid: '900000002', major: 'Engineering', class: '2027', registration_order: 1 },
    { name: 'Ben Beta', gtid: '900000003', major: 'Business', class: '2028', registration_order: 2 }
];

const filters = (overrides = {}) => ({
    selectedMajor: 'All',
    selectedClass: 'All',
    query: '',
    selectedSort: 'none',
    ...overrides
});

test('unfiltered results retain input identity and major/class filters retain order', () => {
    assert.equal(filterBidCommitteeRushees(rushees, filters()), rushees);
    assert.deepEqual(filterBidCommitteeRushees(rushees, filters({
        selectedMajor: 'Business', selectedClass: '2028'
    })), [rushees[0], rushees[2]]);
});

test('only an exact nine-digit GTID matches within the selected major and class', () => {
    assert.deepEqual(filterBidCommitteeRushees(rushees, filters({ query: ' 900000002 ' })), [rushees[1]]);
    assert.deepEqual(filterBidCommitteeRushees(rushees, filters({
        query: '900000002', selectedMajor: 'Business'
    })), []);
    for (const query of ['90000000', '90000000x', '000000000', 'Ada']) {
        assert.deepEqual(filterBidCommitteeRushees(rushees, filters({ query })), []);
    }
});

test('first, last, and registration-order sorts copy the array', () => {
    for (const [selectedSort, expected] of [
        ['firstName', [rushees[1], rushees[2], rushees[0]]],
        ['lastName', [rushees[0], rushees[2], rushees[1]]],
        ['rusheeId', [rushees[1], rushees[2], rushees[0]]]
    ]) {
        const actual = filterBidCommitteeRushees(rushees, filters({ selectedSort }));
        assert.deepEqual(actual, expected);
        assert.notEqual(actual, rushees);
    }
    assert.deepEqual(rushees.map((rushee) => rushee.gtid), [
        '900000001', '900000002', '900000003'
    ]);
});
