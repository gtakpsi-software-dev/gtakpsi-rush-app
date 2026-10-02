import assert from "node:assert/strict";
import test from "node:test";
import { filterBrothers, filterRushees } from "../../src/features/admin/search/filterAdminSearch.js";

test("rushee search retains name matching, exact GTID matching, and the ten-result limit", () => {
    const rushees = Array.from({ length: 12 }, (_, index) => ({ name: `Ada ${index}`, gtid: `id${index}` }));

    assert.deepEqual(filterRushees(rushees, "ada"), rushees.slice(0, 10));
    assert.deepEqual(filterRushees(rushees, "ID1"), [rushees[1], rushees[10], rushees[11]]);
    assert.deepEqual(filterRushees([{ name: "X", gtid: "ID1" }], "ID1"), []);
    assert.deepEqual(filterRushees(rushees, " ada"), []);
    assert.deepEqual(filterRushees(rushees, "   "), []);
});

test("brother search uses either name shape or email and caps results", () => {
    const brothers = [
        { firstname: "Grace", lastname: "Hopper", email: "g@example.org" },
        { firstName: "Ada", lastName: "Lovelace", email: "ada@example.org" },
        ...Array.from({ length: 11 }, (_, index) => ({ firstname: `Grace${index}`, lastname: "Example" })),
    ];

    assert.deepEqual(filterBrothers(brothers, "grace"), [brothers[0], ...brothers.slice(2, 11)]);
    assert.deepEqual(filterBrothers(brothers, "ADA@EXAMPLE.ORG"), [brothers[1]]);
    assert.deepEqual(filterBrothers(brothers, "Ada Lovelace"), [brothers[1]]);
    assert.deepEqual(filterBrothers(brothers, "   "), []);
});
