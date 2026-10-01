import assert from "node:assert/strict";
import test from "node:test";

import { activeCursorsForField } from "../src/features/collaboration/activeCursorsForField.js";

test("active cursor API takes precedence and only textarea callers cap overlays", () => {
    const calls = [];
    const cursors = [1, 2, 3, 4].map((cursor) => ({ cursor }));
    const collaboration = {
        getActiveCursorsForField(field) {
            calls.push(field);
            return cursors;
        },
        connectedUsers: null,
    };

    assert.equal(activeCursorsForField(collaboration, "notes"), cursors);
    assert.deepEqual(activeCursorsForField(collaboration, "notes", 3), cursors.slice(0, 3));
    assert.deepEqual(calls, ["notes", "notes"]);
});

test("legacy cursor fallback keeps only matching fields with numeric positions", () => {
    const users = [
        { id: "a", field: "notes", cursor: 0 },
        { id: "b", field: "other", cursor: 2 },
        { id: "c", field: "notes", cursor: "3" },
        { id: "d", field: "notes", cursor: -1 },
        { id: "e", field: "notes", cursor: Number.NaN },
        { id: "f", field: "notes", cursor: 5 },
    ];
    const collaboration = { connectedUsers: users };

    assert.deepEqual(activeCursorsForField(collaboration, "notes"), [
        users[0], users[3], users[4], users[5],
    ]);
    assert.deepEqual(activeCursorsForField(collaboration, "notes", 3), [
        users[0], users[3], users[4],
    ]);
});
