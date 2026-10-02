import assert from "node:assert/strict";
import test from "node:test";

import { parseAdminAllowlist } from "../../src/features/auth/parseAdminAllowlist.js";

test("empty admin allowlist stays empty", () => {
    assert.deepEqual(parseAdminAllowlist(undefined), []);
    assert.deepEqual(parseAdminAllowlist(""), []);
    assert.deepEqual(parseAdminAllowlist(" , , "), []);
});

test("admin allowlist preserves normalized entries and their order", () => {
    assert.deepEqual(
        parseAdminAllowlist(" Ada@Example.org ,BOB@EXAMPLE.ORG, ada@example.org "),
        ["ada@example.org", "bob@example.org", "ada@example.org"],
    );
});
