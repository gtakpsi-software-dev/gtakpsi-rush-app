import assert from "node:assert/strict";
import test from "node:test";

import { parseServerDate } from "../src/features/pis/parseServerDate.js";

test("PIS reveal time accepts BSON extended JSON milliseconds", () => {
    assert.equal(parseServerDate({ $date: { $numberLong: "1712345678901" } }).getTime(), 1712345678901);
    assert.equal(parseServerDate({ $date: { $numberLong: "12tail" } }).getTime(), 12);
});

test("plain dates are parsed and invalid plain values become null", () => {
    assert.equal(parseServerDate("2026-09-30T12:00:00Z").toISOString(), "2026-09-30T12:00:00.000Z");
    assert.equal(parseServerDate("not a date"), null);
    assert.equal(parseServerDate({ $date: {} }), null);
});

test("falsy values and malformed BSON retain their original distinct results", () => {
    for (const value of [null, undefined, "", 0]) {
        assert.equal(parseServerDate(value), null);
    }
    const malformed = parseServerDate({ $date: { $numberLong: "bad" } });
    assert.ok(malformed instanceof Date);
    assert.ok(Number.isNaN(malformed.getTime()));
});
