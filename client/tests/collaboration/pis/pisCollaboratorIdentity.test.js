import assert from "node:assert/strict";
import test from "node:test";

import { createPisCollaborator } from "../../../src/features/pis/createPisCollaborator.js";

test("Firebase display name and UID take precedence over stored identity", () => {
    // Verify Firebase display name and UID take precedence over stored identity.
    const ids = [];
    const user = createPisCollaborator(
        { uid: "firebase-1", displayName: "Ari Van One", email: "ari@example.com" },
        JSON.stringify({ _id: "stored-1", firstName: "Stored", lastName: "Name" }),
        (id) => {
            // Capture the generated collaborator ID and return it unchanged.
             ids.push(id); return id; },
    );
    assert.deepEqual(ids, ["firebase-1"]);
    assert.deepEqual(user, { id: "firebase-1", firstName: "Ari", lastName: "Van One" });
});

test("stored naming variants and stored ID retain their original fallback order", () => {
    // Verify stored naming variants and stored ID retain their original fallback order.
    const ids = [];
    const user = createPisCollaborator(
        null,
        JSON.stringify({ _id: "stored-2", firstname: "Bea", lastname: "Two" }),
        (id) => {
            // Capture the generated collaborator ID and return it unchanged.
             ids.push(id); return id; },
    );
    assert.deepEqual(ids, ["stored-2"]);
    assert.deepEqual(user, { id: "stored-2", firstName: "Bea", lastName: "Two" });
});

test("email prefix is used when no display or stored name exists", () => {
    // Verify email prefix is used when no display or stored name exists.
    const user = createPisCollaborator(
        { email: "casey@example.com" },
        JSON.stringify({ _id: "stored-3" }),
        /* Return id to the caller. */ (id) => id,
    );
    assert.deepEqual(user, { id: "stored-3", firstName: "casey", lastName: "" });
});

test("anonymous defaults and single-word display names stay unchanged", () => {
    // Verify anonymous defaults and single-word display names stay unchanged.
    const anonymous = createPisCollaborator(null, null, /* Return the fixed string fixture. */ () => "tab-id");
    assert.deepEqual(anonymous, { id: "tab-id", firstName: "Anonymous", lastName: "User" });
    const singleName = createPisCollaborator({ displayName: "Ari" }, null, /* Return the fixed string fixture. */ () => "tab-id");
    assert.deepEqual(singleName, { id: "tab-id", firstName: "Ari", lastName: "" });
});

test("invalid stored user JSON still throws to the page's outer error handler", () => {
    // Verify invalid stored user JSON still throws to the page's outer error handler.
    assert.throws(
        /* Invoke the operation whose failure is being asserted. */
        () => createPisCollaborator(null, "{invalid",
        /* Return the fixed string fixture. */
        () => "tab-id"), SyntaxError);
});
