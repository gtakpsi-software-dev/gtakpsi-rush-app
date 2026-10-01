import assert from "node:assert/strict";
import test from "node:test";
import {
    applyCursorPosition,
    applyTypingIndicator,
    pruneTypingUsers,
    clearStaleCursors,
    getActiveCursors,
} from "../src/features/pis/collaborationPresence.js";

test("cursor events update only the matching user and clear the field on blur", () => {
    const users = [{ id: "one", cursor: 2, field: "answer" }, { id: "two", cursor: 1 }];
    const moved = applyCursorPosition(users, {
        userId: "one", field: "other", position: 4, timestamp: 0,
    }, () => 42);

    assert.deepEqual(moved[0], { id: "one", cursor: 4, field: "other", cursorTimestamp: 42 });
    assert.equal(moved[1], users[1]);
    assert.deepEqual(applyCursorPosition(moved, {
        userId: "one", field: "other", position: null, timestamp: 43,
    })[0], { id: "one", cursor: null, field: null, cursorTimestamp: 43 });
});

test("typing indicators replace and remove entries by user and field", () => {
    const original = new Map([["other-answer", { userId: "other", field: "answer", timestamp: 1 }]]);
    const active = applyTypingIndicator(original, {
        userId: "other", userName: "Ada", field: "answer", isTyping: true,
    }, () => 10);

    assert.notEqual(active, original);
    assert.deepEqual(active.get("other-answer"), {
        userId: "other", userName: "Ada", field: "answer", timestamp: 10,
    });
    assert.equal(original.get("other-answer").timestamp, 1);
    assert.equal(applyTypingIndicator(active, {
        userId: "other", field: "answer", isTyping: false,
    }).has("other-answer"), false);
});

test("typing and cursor expiry keep their original strict boundaries", () => {
    const typing = new Map([
        ["fresh", { timestamp: 7001 }],
        ["boundary", { timestamp: 7000 }],
    ]);
    assert.deepEqual([...pruneTypingUsers(typing, 10000).keys()], ["fresh"]);

    const users = [
        { id: "fresh", field: "answer", cursor: 1, cursorTimestamp: 1 },
        { id: "boundary", field: "answer", cursor: 2, cursorTimestamp: 0 },
    ];
    const cleared = clearStaleCursors(users, 10002);
    assert.deepEqual(cleared[0], { ...users[0], field: null, cursor: null });
    assert.equal(cleared[1], users[1]);

    const visible = getActiveCursors([
        { field: "answer", cursor: 1, cursorTimestamp: 1 },
        { field: "answer", cursor: 2, cursorTimestamp: 0 },
        { field: "answer", cursor: "3", cursorTimestamp: 1 },
    ], "answer", 10001);
    assert.deepEqual(visible, [{ field: "answer", cursor: 2, cursorTimestamp: 0 }]);
});
