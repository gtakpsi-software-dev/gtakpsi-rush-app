import assert from "node:assert/strict";
import test from "node:test";

import { getRealtimeBaseUrls } from "../../src/config/realtimeBaseUrls.js";

test("real-time endpoints retain their three deployment keys and local fallbacks", () => {
    assert.deepEqual(getRealtimeBaseUrls({}), {
        pisCollaboration: "http://localhost:3001",
        sorting: "ws://localhost:4001",
        voting: undefined,
    });

    assert.deepEqual(getRealtimeBaseUrls({
        VITE_WEBSOCKET_URL: "https://pis.example",
        VITE_SORTING_BROADCASTER_URL: "wss://sorting.example",
        VITE_BROADCASTER_API_PREFIX: "wss://voting.example",
    }), {
        pisCollaboration: "https://pis.example",
        sorting: "wss://sorting.example",
        voting: "wss://voting.example",
    });
});

test("empty configuration keeps the original per-service fallback behavior", () => {
    assert.deepEqual(getRealtimeBaseUrls({
        VITE_WEBSOCKET_URL: "",
        VITE_SORTING_BROADCASTER_URL: "",
        VITE_BROADCASTER_API_PREFIX: "",
    }), {
        pisCollaboration: "http://localhost:3001",
        sorting: "ws://localhost:4001",
        voting: "",
    });
});
