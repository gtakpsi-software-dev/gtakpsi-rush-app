import assert from "node:assert/strict";
import test from "node:test";
import {
    applyOperation,
    createOperation,
    createOperationsFromDiff,
} from "../src/features/pis/operations.js";
import * as legacyExports from "../src/hooks/useCollaboration.js";

test("the collaboration hook keeps its existing operation exports", () => {
    assert.equal(legacyExports.applyOperation, applyOperation);
    assert.equal(legacyExports.createOperation, createOperation);
    assert.equal(legacyExports.createOperationsFromDiff, createOperationsFromDiff);
});

test("text operations retain insert, delete, replace, and unknown-type behavior", () => {
    assert.equal(applyOperation("abcd", { type: "insert", position: 2, content: "XY" }), "abXYcd");
    assert.equal(applyOperation("abcd", { type: "delete", position: 1, length: 2 }), "ad");
    assert.equal(applyOperation("abcd", { type: "replace", position: 1, length: 2, content: "XY" }), "aXYd");
    assert.equal(applyOperation("abcd", { type: "insert", position: 2 }), "abcd");
    assert.equal(applyOperation("abcd", { type: "delete", position: 2 }), "abcd");
    assert.equal(applyOperation("abcd", { type: "unknown", position: 2 }), "abcd");
});

test("created operations keep their wire fields and generated metadata", () => {
    const operation = createOperation("insert", 3, "hi", 0, "answer");
    assert.deepEqual(
        { type: operation.type, position: operation.position, content: operation.content, length: operation.length, field: operation.field },
        { type: "insert", position: 3, content: "hi", length: 0, field: "answer" }
    );
    assert.equal(typeof operation.timestamp, "number");
    assert.match(operation.id, /^[a-z0-9]{1,9}$/);
});

test("diff operations preserve shared ends and reconstruct the edited text", () => {
    for (const [before, after, expectedTypes] of [
        ["same", "same", []],
        ["abcd", "abXYcd", ["insert"]],
        ["abcd", "ad", ["delete"]],
        ["abcd", "aXYd", ["delete", "insert"]],
    ]) {
        const operations = createOperationsFromDiff(before, after, "answer");
        assert.deepEqual(operations.map(({ type }) => type), expectedTypes);
        assert.ok(operations.every(({ field }) => field === "answer"));
        assert.equal(operations.reduce(applyOperation, before), after);
    }
});
