import assert from "node:assert/strict";
import test from "node:test";

import { applySortingDrop } from "../../../src/features/sorting/applySortingDrop.js";

const first = { id: "r1", sortingStatus: "UNSORTED", sortingOrder: 1 };
const second = { id: "r2", sortingStatus: "UNSORTED", sortingOrder: 2 };
const third = { id: "r3", sortingStatus: "IN_CLOUD", sortingOrder: 1 };

// Create isolated state, dependency fakes, and captured calls for this test.
function setup() {
    const columns = { UNSORTED: [first, second], IN_CLOUD: [third], OTHER: [] };
    const moves = [];
    // Record enqueue move calls for assertions.
    const enqueueMove = (move) => moves.push(move);
    return { columns, moves, enqueueMove };
}

test("same-column drop reorders cards and queues its original target index", () => {
    // Verify same-column drop reorders cards and queues its original target index.
    const { columns, moves, enqueueMove } = setup();
    const updated = applySortingDrop(columns, {
        id: "r1", fromColumn: "UNSORTED", targetColumn: "UNSORTED", targetIndex: 1, enqueueMove,
    });
    assert.notEqual(updated, columns);
    assert.deepEqual(updated.UNSORTED.map(/* Return the fixture for this scenario. */ ({ id, sortingStatus, sortingOrder }) =>
        [id, sortingStatus, sortingOrder]), [
        ["r2", "UNSORTED", 1], ["r1", "UNSORTED", 2],
    ]);
    assert.equal(updated.IN_CLOUD, columns.IN_CLOUD);
    assert.deepEqual(moves, [{
        fromColumn: "UNSORTED", toColumn: "UNSORTED", movedRusheeId: "r1", targetIndex: 1,
    }]);
});

test("cross-column drop updates both orders without changing the other columns", () => {
    // Verify cross-column drop updates both orders without changing the other columns.
    const { columns, moves, enqueueMove } = setup();
    const updated = applySortingDrop(columns, {
        id: "r2", fromColumn: "UNSORTED", targetColumn: "IN_CLOUD", targetIndex: 0, enqueueMove,
    });
    assert.deepEqual(updated.UNSORTED.map(/* Return the fixture for this scenario. */ (card) => [card.id, card.sortingOrder]), [["r1", 1]]);
    assert.deepEqual(updated.IN_CLOUD.map(/* Return the fixture for this scenario. */ (card) => [card.id, card.sortingStatus, card.sortingOrder]), [
        ["r2", "IN_CLOUD", 1], ["r3", "IN_CLOUD", 2],
    ]);
    assert.equal(updated.OTHER, columns.OTHER);
    assert.deepEqual(moves, [{
        fromColumn: "UNSORTED", toColumn: "IN_CLOUD", movedRusheeId: "r2", targetIndex: 0,
    }]);
});

test("missing card returns the exact previous state and does not persist", () => {
    // Verify missing card returns the exact previous state and does not persist.
    const { columns, moves, enqueueMove } = setup();
    const updated = applySortingDrop(columns, {
        id: "missing", fromColumn: "UNSORTED", targetColumn: "IN_CLOUD", targetIndex: 0, enqueueMove,
    });
    assert.equal(updated, columns);
    assert.deepEqual(moves, []);
});

test("null, undefined, and oversized indices append after removal", () => {
    // Verify null, undefined, and oversized indices append after removal.
    for (const targetIndex of [null, undefined, 99]) {
        const { columns, moves, enqueueMove } = setup();
        const updated = applySortingDrop(columns, {
            id: "r1", fromColumn: "UNSORTED", targetColumn: "UNSORTED", targetIndex, enqueueMove,
        });
        assert.deepEqual(updated.UNSORTED.map(/* Extract each card ID for ordering assertions. */ (card) => card.id), ["r2", "r1"]);
        assert.equal(moves[0].targetIndex, 1);
    }
});

test("negative indices retain JavaScript splice positioning and queued value", () => {
    // Verify negative indices retain JavaScript splice positioning and queued value.
    const { columns, moves, enqueueMove } = setup();
    const updated = applySortingDrop(columns, {
        id: "r1", fromColumn: "UNSORTED", targetColumn: "IN_CLOUD", targetIndex: -1, enqueueMove,
    });
    assert.deepEqual(updated.IN_CLOUD.map(/* Extract each card ID for ordering assertions. */ (card) => card.id), ["r1", "r3"]);
    assert.equal(moves[0].targetIndex, -1);
});
