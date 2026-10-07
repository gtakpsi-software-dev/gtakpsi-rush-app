import assert from "node:assert/strict";
import test from "node:test";

import { applySavedSortingTags } from "../../../src/features/sorting/applySavedSortingTags.js";

test("saved notes refresh tags for the matching card without changing other cards", () => {
    const selected = { id: "r1", sortingTags: ["night_1"], sortingOrder: 1 };
    const neighbor = { id: "r2", sortingTags: [], sortingOrder: 2 };
    const other = { id: "r3", sortingTags: [], sortingOrder: 1 };
    const columns = { UNSORTED: [selected, neighbor], IN_CLOUD: [other] };
    const tags = ["night_2", "pis"];

    const updated = applySavedSortingTags(columns, "r1", tags);

    assert.notEqual(updated, columns);
    assert.notEqual(updated.UNSORTED, columns.UNSORTED);
    assert.notEqual(updated.IN_CLOUD, columns.IN_CLOUD);
    assert.deepEqual(updated.UNSORTED[0], { ...selected, sortingTags: tags });
    assert.equal(updated.UNSORTED[0].sortingTags, tags);
    assert.equal(updated.UNSORTED[1], neighbor);
    assert.equal(updated.IN_CLOUD[0], other);
    assert.deepEqual(columns.UNSORTED[0].sortingTags, ["night_1"]);
});

test("missing and duplicate IDs retain the original all-column mapping behavior", () => {
    const first = { id: "r1", sortingTags: [] };
    const second = { id: "r1", sortingTags: ["pis"] };
    const columns = { UNSORTED: [first], IN_CLOUD: [second], DISCUSSED: [] };

    const missing = applySavedSortingTags(columns, "absent", ["night_1"]);
    assert.notEqual(missing, columns);
    for (const key of Object.keys(columns)) {
        assert.notEqual(missing[key], columns[key]);
    }
    assert.equal(missing.UNSORTED[0], first);
    assert.equal(missing.IN_CLOUD[0], second);

    const updated = applySavedSortingTags(columns, "r1", []);
    assert.deepEqual(updated.UNSORTED[0].sortingTags, []);
    assert.deepEqual(updated.IN_CLOUD[0].sortingTags, []);
    assert.notEqual(updated.UNSORTED[0], first);
    assert.notEqual(updated.IN_CLOUD[0], second);
});
