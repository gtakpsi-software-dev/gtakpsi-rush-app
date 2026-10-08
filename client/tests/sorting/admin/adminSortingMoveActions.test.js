import assert from "node:assert/strict";
import test from "node:test";

import { createAdminSortingMoveActions } from "../../../src/features/sorting/createAdminSortingMoveActions.js";

test("admin sorting ignores a drop when no card is being dragged", () => {
    // Verify admin sorting ignores a drop when no card is being dragged.
    const { handleDrop } = createAdminSortingMoveActions({
        dragging: null,
        // Invoke assert.fail with the test inputs.
        setColumns: () => assert.fail("unexpected column update"),
        // Invoke assert.fail with the test inputs.
        clearDragState: () => assert.fail("unexpected drag cleanup"),
    });

    handleDrop("ACTIVE", 0);
});

test("admin sorting clears drag state before the queued move persists and broadcasts", async () => {
    // Verify admin sorting clears drag state before the queued move persists and broadcasts.
    const calls = [];
    const pendingMovesRef = { current: [] };
    const moveInFlightRef = { current: false };
    const fetchDataRef = { current: null };
    let updateColumns;
    const { handleDrop } = createAdminSortingMoveActions({
        dragging: { id: "r1", fromColumn: "UNSORTED", index: 0 },
        // Capture the column updater for later assertions.
        setColumns(updater) {
            calls.push("set-columns");
            updateColumns = updater;
        },
        // Record clear drag state calls for assertions.
        clearDragState: () => calls.push("clear-drag"),
        moveInFlightRef,
        pendingMovesRef,
        fetchDataRef,
        // Record persist move calls for assertions.
        persistMove: async (payload) => calls.push(["persist", payload]),
        // Record ws send calls for assertions.
        wsSend: (payload) => calls.push(["broadcast", payload]),
        // Invoke assert.fail with the test inputs.
        showError: () => assert.fail("unexpected save error"),
    });

    handleDrop("ACTIVE", 0);
    assert.deepEqual(calls, ["set-columns", "clear-drag"]);

    const columns = {
        UNSORTED: [{ id: "r1", sortingStatus: "UNSORTED", sortingOrder: 1 }],
        ACTIVE: [],
    };
    const updated = updateColumns(columns);
    assert.deepEqual(updated.UNSORTED, []);
    assert.deepEqual(updated.ACTIVE, [
        { id: "r1", sortingStatus: "ACTIVE", sortingOrder: 1 },
    ]);
    await new Promise(/* Invoke setTimeout with the test inputs. */ (resolve) => setTimeout(resolve, 0));

    assert.deepEqual(calls, [
        "set-columns",
        "clear-drag",
        ["persist", {
            fromColumn: "UNSORTED", toColumn: "ACTIVE",
            movedRusheeId: "r1", targetIndex: 0,
        }],
        ["broadcast", { type: "card_saved", rushee_id: "r1", new_status: "ACTIVE" }],
    ]);
    assert.deepEqual(pendingMovesRef.current, []);
    assert.equal(moveInFlightRef.current, false);
});
