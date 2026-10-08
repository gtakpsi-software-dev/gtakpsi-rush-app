import assert from "node:assert/strict";
import test from "node:test";
import {
    acceptRemoteTextUpdate,
    acknowledgeTextUpdate,
    rejectTextUpdate,
    normalizeDocumentState,
} from "../../../src/features/pis/collaborationProtocol.js";

test("remote text updates ignore self and stale versions but advance legacy versions", () => {
    // Verify remote text updates ignore self and stale versions but advance legacy versions.
    const known = { answer: 2 };
    const resending = new Set();

    assert.equal(acceptRemoteTextUpdate({ field: "answer", userId: "me", version: 3 }, "me", known, resending), null);
    assert.equal(acceptRemoteTextUpdate({ field: "answer", userId: "other", version: 2 }, "me", known, resending), null);
    assert.deepEqual(acceptRemoteTextUpdate({ field: "answer", userId: "other", value: "next" }, "me", known, resending), {
        field: "answer", userId: "other", value: "next", version: 3,
    });
    assert.equal(known.answer, 3);

    resending.add("answer");
    assert.equal(acceptRemoteTextUpdate({ field: "answer", userId: "other", version: 4 }, "me", known, resending), null);
    assert.equal(known.answer, 4);
});

test("acknowledgements only clear the matching pending update", () => {
    // Verify acknowledgements only clear the matching pending update.
    const known = { answer: 1 };
    const pending = { answer: { clientUpdateId: "new", value: "local" } };
    const resending = new Set(["answer"]);

    acknowledgeTextUpdate({ field: "answer", version: 2, clientUpdateId: "old" }, known, pending, resending);
    assert.deepEqual(pending.answer, { clientUpdateId: "new", value: "local" });
    assert.equal(known.answer, 1);

    acknowledgeTextUpdate({ field: "answer", version: 3, clientUpdateId: "new" }, known, pending, resending);
    assert.equal(pending.answer, undefined);
    assert.equal(known.answer, 3);
    assert.equal(resending.has("answer"), false);
});

test("a matching rejection resends the local value on the server version", () => {
    // Verify a matching rejection resends the local value on the server version.
    const known = {};
    const pending = { answer: { clientUpdateId: "old", value: "local" } };
    const resending = new Set();
    const result = rejectTextUpdate(
        { field: "answer", serverValue: "remote", serverVersion: 5, clientUpdateId: "old" },
        { id: "me", firstName: "Ada", lastName: "Lovelace" },
        known, pending, resending, /* Return the fixed string fixture. */ () => "new"
    );

    assert.deepEqual(result, { resend: {
        field: "answer", value: "local", baseVersion: 5, clientUpdateId: "new",
        userId: "me", userName: "Ada Lovelace",
    } });
    assert.equal(known.answer, 5);
    assert.deepEqual(pending.answer, { clientUpdateId: "new", value: "local" });
    assert.equal(resending.has("answer"), true);
});

test("a rejection without a matching pending update accepts the server value", () => {
    // Verify a rejection without a matching pending update accepts the server value.
    const known = {};
    const pending = { answer: { clientUpdateId: "new", value: "local" } };
    const resending = new Set();
    const result = rejectTextUpdate(
        { field: "answer", serverValue: "remote", serverVersion: 6, clientUpdateId: "old" },
        { id: "me" }, known, pending, resending
    );

    assert.deepEqual(result, { remoteUpdate: { field: "answer", value: "remote", version: 6, userId: "server" } });
    assert.deepEqual(pending.answer, { clientUpdateId: "new", value: "local" });
    assert.equal(known.answer, 6);
});

test("document snapshots preserve legacy values and versioned empty values", () => {
    // Verify document snapshots preserve legacy values and versioned empty values.
    assert.deepEqual(normalizeDocumentState({
        legacy: "old",
        empty: null,
        current: { value: null, version: 4 },
        unversioned: { value: "new" },
    }), {
        values: { legacy: "old", empty: "", current: "", unversioned: "new" },
        versions: { legacy: 0, empty: 0, current: 4, unversioned: 0 },
    });
});
