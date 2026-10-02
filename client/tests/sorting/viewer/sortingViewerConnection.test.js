import assert from "node:assert/strict";
import test from "node:test";

import { connectSortingViewer } from "../../../src/features/sorting/connectSortingViewer.js";

function harness(
    showRusheeNames,
    getCurrentUser = () => ({ displayName: "Brother One", email: "brother@example.com" }),
) {
    const sockets = [];
    const reconnects = [];
    const errors = [];
    const state = { connected: false, viewerCount: 0, ghostCards: {} };
    const wsRef = { current: null };
    const ghostTimestampsRef = { current: {} };
    const fetches = [];
    const fetchDataRef = { current: () => fetches.push("refresh") };

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

    connectSortingViewer({
        url: "wss://sorting.example/ws",
        wsRef,
        getCurrentUser,
        ghostTimestampsRef,
        fetchDataRef,
        setWsConnected: (value) => { state.connected = value; },
        setViewerCount: (value) => { state.viewerCount = value; },
        setGhostCards: (update) => {
            state.ghostCards = typeof update === "function" ? update(state.ghostCards) : update;
        },
        showRusheeNames,
        createWebSocket: (url) => new FakeWebSocket(url),
        scheduleReconnect: (callback, delay) => reconnects.push({ callback, delay }),
        log: () => {},
        logError: (...args) => errors.push(args),
    });

    return { sockets, reconnects, errors, state, wsRef, fetches };
}

for (const [showRusheeNames, expectedName] of [[false, "Rushee"], [true, "Private Name"]]) {
    test(`viewer socket retains ${showRusheeNames ? "brother" : "bid committee"} name visibility and reconnect timing`, () => {
        const { sockets, reconnects, state, wsRef, fetches } = harness(showRusheeNames);
        const first = sockets[0];
        assert.equal(first.url, "wss://sorting.example/ws");
        assert.equal(wsRef.current, first);

        first.onopen();
        assert.equal(state.connected, true);
        assert.deepEqual(first.sent, [{ type: "join", is_admin: false, name: "Brother One" }]);

        first.onmessage({ data: JSON.stringify({ type: "viewer_count", count: 4 }) });
        first.onmessage({ data: JSON.stringify({
            type: "drag_start", rushee_id: "r1", rushee_name: "Private Name",
            x: 1, y: 2, dragger_name: "Admin",
        }) });
        assert.equal(state.viewerCount, 4);
        assert.equal(state.ghostCards.r1.rusheeName, expectedName);

        first.onmessage({ data: JSON.stringify({ type: "card_moved", rushee_id: "r1" }) });
        assert.deepEqual(fetches, ["refresh"]);

        first.onclose();
        assert.equal(state.connected, false);
        assert.deepEqual(state.ghostCards, {});
        assert.equal(reconnects.length, 1);
        assert.equal(reconnects[0].delay, 3000);
        reconnects[0].callback();
        assert.equal(sockets.length, 2);
        assert.equal(wsRef.current, sockets[1]);
    });
}

test("viewer socket closes on error and reports malformed messages", () => {
    const { sockets, errors } = harness(false);
    sockets[0].onmessage({ data: "bad json" });
    assert.equal(errors[0][0], "Failed to parse WS message");

    const failure = new Error("network");
    sockets[0].onerror(failure);
    assert.deepEqual(errors[1], ["WebSocket error", failure]);
    assert.equal(sockets[0].closed, true);
});

test("viewer join name uses current user on each open and keeps the existing fallbacks", () => {
    let user = { email: "brother@example.com" };
    const { sockets, reconnects } = harness(false, () => user);
    sockets[0].onopen();
    assert.equal(sockets[0].sent[0].name, "brother");

    sockets[0].onclose();
    reconnects[0].callback();
    user = null;
    sockets[1].onopen();
    assert.equal(sockets[1].sent[0].name, "Viewer");
});
