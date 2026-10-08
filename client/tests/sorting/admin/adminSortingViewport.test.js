import assert from "node:assert/strict";
import test from "node:test";

import { createSortingViewportHandlers } from "../../../src/features/sorting/createSortingViewportHandlers.js";

// Create isolated state, dependency fakes, and captured calls for this test.
function harness(initialScale = 1, initialTranslate = { x: 20, y: 30 }) {
    const calls = [];
    const state = { scale: initialScale, translate: initialTranslate };
    const panState = { current: { panning: false, startX: 0, startY: 0, origX: 0, origY: 0 } };
    const handlers = createSortingViewportHandlers({
        scaleLimits: { min: 0.5, max: 2 },
        panState,
        translate: initialTranslate,
        // Apply direct or functional scale updates and capture the result.
        setScale: (update) => {
            state.scale = typeof update === "function" ? update(state.scale) : update;
            calls.push(["scale", state.scale]);
        },
        // Apply direct or functional translation updates and capture the result.
        setTranslate: (update) => {
            state.translate = typeof update === "function" ? update(state.translate) : update;
            calls.push(["translate", state.translate]);
        },
    });
    return { calls, state, panState, handlers };
}

// Build a wheel event fixture with a captured prevent-default count.
function wheelEvent(overrides = {}) {
    let prevented = 0;
    const event = {
        target: { closest: /* Return null from this dependency stub. */ () => null },
        deltaX: 4,
        deltaY: 10,
        ctrlKey: false,
        metaKey: false,
        // Update prevented in the test harness.
        preventDefault: () => { prevented += 1; },
        ...overrides,
    };
    return { event, prevented: /* Return prevented to the caller. */ () => prevented };
}

test("wheel events inside notes keep native scrolling and state untouched", () => {
    // Verify wheel events inside notes keep native scrolling and state untouched.
    const { handlers, calls } = harness();
    const { event, prevented } = wheelEvent({ target: { closest: /* Return the closest fixture for this scenario. */ () => ({}) }, ctrlKey: true });
    handlers.handleWheel(event);
    assert.equal(prevented(), 0);
    assert.deepEqual(calls, []);
});

test("control and command wheel zoom use the original delta and bounds", () => {
    // Verify control and command wheel zoom use the original delta and bounds.
    const { handlers, state, calls } = harness(1.95);
    const control = wheelEvent({ ctrlKey: true, deltaY: -100 });
    handlers.handleWheel(control.event);
    assert.equal(control.prevented(), 1);
    assert.equal(state.scale, 2);

    const command = wheelEvent({ metaKey: true, deltaY: 2000 });
    handlers.handleWheel(command.event);
    assert.equal(command.prevented(), 1);
    assert.equal(state.scale, 0.5);
    assert.deepEqual(calls, [["scale", 2], ["scale", 0.5]]);
});

test("plain wheel pans opposite the scroll deltas", () => {
    // Verify plain wheel pans opposite the scroll deltas.
    const { handlers, state, calls } = harness();
    const { event, prevented } = wheelEvent();
    handlers.handleWheel(event);
    assert.equal(prevented(), 1);
    assert.deepEqual(state.translate, { x: 16, y: 20 });
    assert.deepEqual(calls, [["translate", { x: 16, y: 20 }]]);
});

test("zoom buttons preserve step sizes, clamping, and reset coordinates", () => {
    // Verify zoom buttons preserve step sizes, clamping, and reset coordinates.
    const { handlers, state, calls } = harness(1.95);
    handlers.zoomIn();
    assert.equal(state.scale, 2);
    for (let count = 0; count < 20; count += 1) handlers.zoomOut();
    assert.equal(state.scale, 0.5);
    handlers.resetView();
    assert.equal(state.scale, 1);
    assert.deepEqual(state.translate, { x: 0, y: 0 });
    assert.deepEqual(calls.at(-2), ["scale", 1]);
    assert.deepEqual(calls.at(-1), ["translate", { x: 0, y: 0 }]);
});

test("right-click outside cards pans from the original pointer and translation", () => {
    // Verify right-click outside cards pans from the original pointer and translation.
    const { handlers, state, panState } = harness();
    let prevented = 0;
    const event = {
        button: 2, clientX: 100, clientY: 200,
        target: { closest: /* Return null from this dependency stub. */ () => null },
        // Update prevented in the test harness.
        preventDefault: () => { prevented += 1; },
    };
    handlers.onMouseDown(event);
    assert.equal(prevented, 1);
    assert.deepEqual(panState.current, {
        panning: true, startX: 100, startY: 200, origX: 20, origY: 30,
    });
    handlers.onMouseMove({ clientX: 110, clientY: 195 });
    assert.deepEqual(state.translate, { x: 30, y: 25 });
    handlers.onMouseUp();
    handlers.onMouseMove({ clientX: 500, clientY: 500 });
    assert.deepEqual(state.translate, { x: 30, y: 25 });
    assert.equal(panState.current.panning, false);
});

test("left clicks and right clicks on cards cannot begin a pan", () => {
    // Verify left clicks and right clicks on cards cannot begin a pan.
    const { handlers, panState, calls } = harness();
    let prevented = 0;
    const event = {
        button: 0, target: { closest: /* Return null from this dependency stub. */ () => null },
        // Update prevented in the test harness.
        preventDefault: () => { prevented += 1; },
    };
    handlers.onMouseDown(event);
    handlers.onMouseDown({ ...event, button: 2, target: { closest: /* Return the closest fixture for this scenario. */ () => ({}) } });
    assert.equal(prevented, 0);
    assert.equal(panState.current.panning, false);
    assert.deepEqual(calls, []);
});

test("context menu always prevents its browser default", () => {
    // Verify context menu always prevents its browser default.
    const { handlers } = harness();
    let prevented = false;
    handlers.onContextMenu({ preventDefault: () => {
        // Update prevented in the test harness.
         prevented = true; } });
    assert.equal(prevented, true);
});
