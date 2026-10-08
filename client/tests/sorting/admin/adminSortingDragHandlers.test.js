import assert from "node:assert/strict";
import test from "node:test";

import { createSortingDragHandlers } from "../../../src/features/sorting/createSortingDragHandlers.js";

// Create isolated state, dependency fakes, and captured calls for this test.
function harness(lockedCards = {}) {
    const calls = [];
    const state = { dragging: null, hoverIndex: null };
    const draggingRef = { current: null };
    const dragPositionRef = { current: { x: 0, y: 0 } };
    const throttleRef = { current: null };
    let time = 100;
    const handlers = createSortingDragHandlers({
        lockedCards,
        draggingRef,
        dragPositionRef,
        throttleRef,
        // Record drag changes and update the harness state.
        setDragging: (dragging) => { calls.push(["dragging", dragging]); state.dragging = dragging; },
        // Record hover changes and update the harness state.
        setHoverIndex: (hoverIndex) => { calls.push(["hover", hoverIndex]); state.hoverIndex = hoverIndex; },
        // Record ws send calls for assertions.
        wsSend: (message) => calls.push(["send", message]),
        // Return time to the caller.
        now: () => time,
    });
    return { handlers, state, calls, draggingRef, dragPositionRef, throttleRef, setTime: (value) => {
        // Update time in the test harness.
         time = value; } };
}

const rushee = { id: "r1", fullName: "Ada One" };

test("a remotely locked card blocks drag without local state or messages", () => {
    // Verify a remotely locked card blocks drag without local state or messages.
    const { handlers, state, calls, draggingRef } = harness({ r1: "Other Admin" });
    let prevented = false;
    handlers.handleDragStart(rushee, "UNSORTED", 2, { preventDefault: () => {
        // Update prevented in the test harness.
         prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(state.dragging, null);
    assert.equal(draggingRef.current, null);
    assert.deepEqual(calls, []);
});

test("an existing local drag can restart its locked card with the same coordinates and payload", () => {
    // Verify an existing local drag can restart its locked card with the same coordinates and payload.
    const { handlers, state, calls, draggingRef, dragPositionRef } = harness({ r1: "Other Admin" });
    draggingRef.current = { id: "r1" };
    handlers.handleDragStart(rushee, "IN_CLOUD", 1, {
        currentTarget: { getBoundingClientRect: /* Return the bounding client rect fixture for this scenario. */ () => ({ left: 12, top: 34 }) },
    });
    assert.deepEqual(draggingRef.current, { id: "r1", fromColumn: "IN_CLOUD", index: 1, rushee });
    assert.deepEqual(state.dragging, draggingRef.current);
    assert.notEqual(state.dragging, draggingRef.current);
    assert.deepEqual(dragPositionRef.current, { x: 12, y: 34 });
    assert.deepEqual(calls, [
        ["dragging", state.dragging],
        ["send", { type: "drag_start", rushee_id: "r1", rushee_name: "Ada One", x: 12, y: 34 }],
    ]);
});

test("drag start without a target uses the original zero-coordinate fallback", () => {
    // Verify drag start without a target uses the original zero-coordinate fallback.
    const { handlers, calls, dragPositionRef } = harness();
    handlers.handleDragStart(rushee, "UNSORTED", 0);
    assert.deepEqual(dragPositionRef.current, { x: 0, y: 0 });
    assert.deepEqual(calls.at(-1), ["send", {
        type: "drag_start", rushee_id: "r1", rushee_name: "Ada One", x: 0, y: 0,
    }]);
});

test("drag over updates hover each time but sends movement only after the strict throttle", () => {
    // Verify drag over updates hover each time but sends movement only after the strict throttle.
    const { handlers, calls, state, draggingRef, dragPositionRef, throttleRef, setTime } = harness();
    draggingRef.current = { id: "r1" };
    let prevented = 0;
    const event = { preventDefault: () => {
        // Update prevented in the test harness.
         prevented += 1; }, clientX: 9, clientY: 11 };
    handlers.handleDragOver(event, "UNSORTED", 1);
    setTime(133);
    handlers.handleDragOver({ ...event, clientX: 10 }, "IN_CLOUD", 2);
    assert.equal(prevented, 2);
    assert.deepEqual(state.hoverIndex, { column: "IN_CLOUD", index: 2 });
    assert.deepEqual(dragPositionRef.current, { x: 9, y: 11 });
    assert.equal(throttleRef.current, 100);
    assert.equal(calls.filter(/* Match type to "send". */ ([type]) => type === "send").length, 1);

    setTime(134);
    handlers.handleDragOver({ ...event, clientX: 12, clientY: 14 }, "IN_CLOUD", 3);
    assert.deepEqual(dragPositionRef.current, { x: 12, y: 14 });
    assert.equal(throttleRef.current, 134);
    assert.deepEqual(calls.at(-1), ["send", {
        type: "drag_move", rushee_id: "r1", x: 12, y: 14,
    }]);
});

test("throttled movement updates position even without an active drag", () => {
    // Verify throttled movement updates position even without an active drag.
    const { handlers, calls, dragPositionRef } = harness();
    handlers.handleDragOver({
        /* Provide an inert prevent default stub for this test. */
        preventDefault() {}, clientX: 5, clientY: 7 }, "UNSORTED", 0);
    assert.deepEqual(dragPositionRef.current, { x: 5, y: 7 });
    assert.deepEqual(calls, [["hover", { column: "UNSORTED", index: 0 }]]);
});

test("drop and browser drag end notify peers before clearing; denial cancels silently", () => {
    // Verify drop and browser drag end notify peers before clearing; denial cancels silently.
    const { handlers, state, calls, draggingRef } = harness();
    draggingRef.current = { id: "r1" };
    handlers.clearDragState();
    assert.deepEqual(calls, [
        ["send", { type: "drag_end", rushee_id: "r1" }],
        ["dragging", null],
        ["hover", { column: null, index: null }],
    ]);
    assert.equal(draggingRef.current, null);
    assert.equal(state.dragging, null);

    draggingRef.current = { id: "r1" };
    calls.length = 0;
    handlers.handleDragEnd();
    assert.deepEqual(calls, [
        ["send", { type: "drag_end", rushee_id: "r1" }],
        ["dragging", null],
        ["hover", { column: null, index: null }],
    ]);

    draggingRef.current = { id: "r1" };
    calls.length = 0;
    handlers.cancelDragState();
    assert.deepEqual(calls, [
        ["dragging", null],
        ["hover", { column: null, index: null }],
    ]);
    assert.equal(draggingRef.current, null);
});
