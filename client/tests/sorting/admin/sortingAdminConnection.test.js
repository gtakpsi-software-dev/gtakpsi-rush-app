import assert from "node:assert/strict";
import test from "node:test";

import { connectSortingAdmin } from "../../../src/features/sorting/connectSortingAdmin.js";

// Create isolated state, dependency fakes, and captured calls for this test.
function harness(getCurrentUser = /* Return the fixture for this scenario. */ () => ({ email: "admin@example.edu" })) {
    const sockets = [];
    const reconnects = [];
    const errors = [];
    const calls = [];
    const state = { connected: false, viewerCount: 0, ghosts: {}, locks: {} };
    const wsRef = { current: null };

    class FakeWebSocket {
        // Register a fake socket with recorded outbound messages and close state.
        constructor(url) {
            this.url = url;
            this.sent = [];
            this.closed = false;
            sockets.push(this);
        }

        // Record send calls for assertions.
        send(message) { this.sent.push(JSON.parse(message)); }
        // Update this.closed in the test harness.
        close() { this.closed = true; }
    }

    connectSortingAdmin({
        url: "wss://sorting.example/ws",
        wsRef,
        getCurrentUser,
        draggingRef: { current: { id: "r1" } },
        ghostTimestampsRef: { current: {} },
        fetchDataRef: { current: /* Record current calls for assertions. */ () => calls.push("refresh") },
        // Update state.connected in the test harness.
        setWsConnected: (value) => { state.connected = value; },
        // Update state.viewerCount in the test harness.
        setViewerCount: (value) => { state.viewerCount = value; },
        // Update state.ghosts in the test harness.
        setGhostCards: (update) => {
            state.ghosts = typeof update === "function" ? update(state.ghosts) : update;
        },
        // Update state.locks in the test harness.
        setLockedCards: (update) => {
            state.locks = typeof update === "function" ? update(state.locks) : update;
        },
        // Record cancel drag state calls for assertions.
        cancelDragState: () => calls.push("cancel"),
        // Create a fake socket for the requested URL.
        createWebSocket: (url) => new FakeWebSocket(url),
        // Record schedule reconnect calls for assertions.
        scheduleReconnect: (callback, delay) => reconnects.push({ callback, delay }),
        // Provide an inert log stub for this test.
        log: () => {},
        // Record log error calls for assertions.
        logError: (...args) => errors.push(args),
    });

    return { sockets, reconnects, errors, calls, state, wsRef };
}

test("admin socket joins as admin, dispatches messages, clears state, and reconnects", () => {
    // Verify admin socket joins as admin, dispatches messages, clears state, and reconnects.
    const { sockets, reconnects, calls, state, wsRef } = harness();
    const first = sockets[0];
    assert.equal(first.url, "wss://sorting.example/ws");
    assert.equal(wsRef.current, first);

    first.onopen();
    assert.equal(state.connected, true);
    assert.deepEqual(first.sent, [{ type: "join", is_admin: true, name: "admin" }]);

    first.onmessage({ data: JSON.stringify({ type: "viewer_count", count: 4 }) });
    first.onmessage({ data: JSON.stringify({
        type: "drag_denied", rushee_id: "r1", dragger_name: "Other Admin",
    }) });
    assert.equal(state.viewerCount, 4);
    assert.deepEqual(state.locks, { r1: "Other Admin" });
    assert.deepEqual(calls, ["cancel"]);

    first.onclose();
    assert.equal(state.connected, false);
    assert.deepEqual(state.ghosts, {});
    assert.deepEqual(state.locks, {});
    assert.equal(reconnects[0].delay, 3000);
    reconnects[0].callback();
    assert.equal(sockets.length, 2);
    assert.equal(wsRef.current, sockets[1]);
});

test("admin socket keeps display-name fallback and error handling", () => {
    // Verify admin socket keeps display-name fallback and error handling.
    let user = { displayName: "Lead Admin", email: "admin@example.edu" };
    const { sockets, reconnects, errors } = harness(/* Return user to the caller. */ () => user);
    sockets[0].onopen();
    assert.equal(sockets[0].sent[0].name, "Lead Admin");

    sockets[0].onmessage({ data: "invalid json" });
    assert.equal(errors[0][0], "Failed to parse WS message");

    sockets[0].onclose();
    reconnects[0].callback();
    user = null;
    sockets[1].onopen();
    assert.equal(sockets[1].sent[0].name, "Admin");

    const failure = new Error("network");
    sockets[1].onerror(failure);
    assert.deepEqual(errors[1], ["WebSocket error", failure]);
    assert.equal(sockets[1].closed, true);
});
