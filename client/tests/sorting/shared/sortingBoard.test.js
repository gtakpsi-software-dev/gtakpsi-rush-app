import assert from "node:assert/strict";
import test from "node:test";

import {
    STATUSES,
    TAGS,
    MIN_SCALE,
    MAX_SCALE,
    createEmptyColumns,
    groupSortingRows,
} from "../../../src/features/sorting/board.js";

test("sorting boards keep their six column labels and visible tag classes", () => {
    assert.deepEqual(STATUSES, [
        { key: "UNSORTED", label: "Unsorted" },
        { key: "IN_CLOUD", label: "In Cloud" },
        { key: "MID_CLOUD", label: "Mid Cloud" },
        { key: "OUT_CLOUD", label: "Out Cloud" },
        { key: "DISCUSSED", label: "Discussed Rushees" },
        { key: "INELIGIBLE", label: "Ineligible" },
    ]);
    assert.deepEqual(TAGS, [
        { key: "night_1", label: "Night 1", color: "bg-blue-100 text-blue-700 border-blue-200" },
        { key: "night_2", label: "Night 2", color: "bg-purple-100 text-purple-700 border-purple-200" },
        { key: "closed_night", label: "Closed Night", color: "bg-amber-100 text-amber-700 border-amber-200" },
        { key: "closed_night_invite", label: "Closed Night Invite", color: "bg-orange-100 text-orange-700 border-orange-200" },
        { key: "pis", label: "PIS", color: "bg-green-100 text-green-700 border-green-200" },
        { key: "hard_no", label: "Hard No", color: "bg-red-100 text-red-600 border-red-200" },
    ]);
    assert.equal(MIN_SCALE, 0.5);
    assert.equal(MAX_SCALE, 2);
});

test("unknown sorting statuses fall back to Unsorted and each column orders by sortingOrder", () => {
    const rows = [
        { id: "a", sortingStatus: "IN_CLOUD", sortingOrder: 3 },
        { id: "b", sortingStatus: "IN_CLOUD", sortingOrder: 1 },
        { id: "c", sortingStatus: "UNKNOWN", sortingOrder: 5 },
        { id: "d", sortingStatus: null, sortingOrder: 2 },
        { id: "e", sortingStatus: "DISCUSSED", sortingOrder: 1 },
    ];

    const columns = groupSortingRows(rows);
    assert.deepEqual(Object.keys(columns), STATUSES.map(({ key }) => key));
    assert.deepEqual(columns.IN_CLOUD.map(({ id }) => id), ["b", "a"]);
    assert.deepEqual(columns.UNSORTED.map(({ id }) => id), ["d", "c"]);
    assert.deepEqual(columns.DISCUSSED.map(({ id }) => id), ["e"]);
    assert.deepEqual(columns.OUT_CLOUD, []);
    assert.deepEqual(rows.map(({ id }) => id), ["a", "b", "c", "d", "e"]);
    assert.strictEqual(columns.IN_CLOUD[0], rows[1]);
});

test("equal orders retain input order and each board gets fresh arrays", () => {
    const columns = groupSortingRows([
        { id: "first", sortingStatus: "UNSORTED", sortingOrder: 4 },
        { id: "second", sortingStatus: "UNSORTED", sortingOrder: 4 },
        { id: "third", sortingStatus: "UNSORTED" },
    ]);
    assert.deepEqual(columns.UNSORTED.map(({ id }) => id), ["first", "second", "third"]);

    const other = createEmptyColumns();
    assert.notStrictEqual(other.UNSORTED, columns.UNSORTED);
    assert.deepEqual(other, createEmptyColumns());
});
