import assert from "node:assert/strict";
import test from "node:test";

import { getStableUserId } from "../../../src/features/pis/stableUserId.js";

test("backend collaborator ID takes precedence without touching tab storage", () => {
    const previousStorage = globalThis.sessionStorage;
    globalThis.sessionStorage = {
        getItem() { throw new Error("storage must not be read"); },
        setItem() { throw new Error("storage must not be written"); },
    };
    try {
        assert.equal(getStableUserId("backend-id"), "backend-id");
    } finally {
        if (previousStorage === undefined) delete globalThis.sessionStorage;
        else globalThis.sessionStorage = previousStorage;
    }
});

test("existing tab collaborator ID is reused without generating another", () => {
    const previousStorage = globalThis.sessionStorage;
    const calls = [];
    globalThis.sessionStorage = {
        getItem(key) { calls.push(["get", key]); return "stored-id"; },
        setItem() { throw new Error("existing ID must not be overwritten"); },
    };
    try {
        assert.equal(getStableUserId(null), "stored-id");
        assert.deepEqual(calls, [["get", "collab_stable_user_id"]]);
    } finally {
        if (previousStorage === undefined) delete globalThis.sessionStorage;
        else globalThis.sessionStorage = previousStorage;
    }
});

test("missing tab ID is generated once and stored under the original key", () => {
    const previousStorage = globalThis.sessionStorage;
    const previousNow = Date.now;
    const previousRandom = Math.random;
    const calls = [];
    globalThis.sessionStorage = {
        getItem(key) { calls.push(["get", key]); return null; },
        setItem(key, value) { calls.push(["set", key, value]); },
    };
    Date.now = () => 1700000000000;
    Math.random = () => 0.125;
    try {
        const expected = `user_1700000000000_${(0.125).toString(36).substr(2, 9)}`;
        assert.equal(getStableUserId(undefined), expected);
        assert.deepEqual(calls, [
            ["get", "collab_stable_user_id"],
            ["set", "collab_stable_user_id", expected],
        ]);
    } finally {
        Date.now = previousNow;
        Math.random = previousRandom;
        if (previousStorage === undefined) delete globalThis.sessionStorage;
        else globalThis.sessionStorage = previousStorage;
    }
});
