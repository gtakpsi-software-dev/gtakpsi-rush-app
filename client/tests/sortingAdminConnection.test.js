import assert from "node:assert/strict";
import test from "node:test";

import { connectSortingAdmin } from "../src/features/sorting/connectSortingAdmin.js";

function harness(getCurrentUser = () => ({ email: "admin@example.edu" })) {
    const sockets = [];
    const reconnects = [];
    const errors = [];
    const calls = [];
    const state = { connected: false, viewerCount: 0, ghosts: {}, locks: {} };
    const wsRef = { current: null };

    class FakeWebSocket {
        constructor(url) {
            this.url = url;
            this.sent = [];
            this.closed = false;
            sockets.push(this);
        }

        send(message) { this.sent.push(JSON.parse(message)); }
        close() { this.closed = true; }
    }

    connectSortingAdmin({
        url: "wss://sorting.example/ws",
        wsRef,
        getCurrentUser,
        draggingRef: { current: { id: "r1" } },
        ghostTimestampsRef: { current: {} },
        fetchDataRef: { current: () => calls.push("refresh") },
        setWsConnected: (value) => { state.connected = value; },
        setViewerCount: (value) => { state.viewerCount = value; },
        setGhostCards: (update) => {
            state.ghosts = typeof update === "function" ? update(state.ghosts) : update;
        },
        setLockedCards: (update) => {
            state.locks = typeof update === "function" ? update(state.locks) : update;
        },
        cancelDragState: () => calls.push("cancel"),
        createWebSocket: (url) => new FakeWebSocket(url),
        scheduleReconnect: (callback, delay) => reconnects.push({ callback, delay }),
        log: () => {},
        logError: (...args) => errors.push(args),
    });

    return { sockets, reconnects, errors, calls, state, wsRef };
}

test("admin socket joins as admin, dispatches messages, clears state, and reconnects", () => {
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
    let user = { displayName: "Lead Admin", email: "admin@example.edu" };
    const { sockets, reconnects, errors } = harness(() => user);
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
