import assert from "node:assert/strict";
import test from "node:test";

import { loadBrotherDirectory } from "../../src/features/brothers/loadBrotherDirectory.js";

test("brother directory keeps the Firestore query and voting fields", async () => {
    // Verify brother directory keeps the Firestore query and voting fields.
    const calls = [];
    const database = {};
    const collectionRef = {};
    const ordering = {};
    const queryRef = {};
    const brothers = await loadBrotherDirectory({
        db: database,
        // Record collection lookup and return the fixture reference.
        collection(db, name) {
            calls.push(["collection", db, name]);
            return collectionRef;
        },
        // Record the requested ordering and return its fixture.
        orderBy(field) {
            calls.push(["orderBy", field]);
            return ordering;
        },
        // Record query construction and return its fixture.
        query(ref, order) {
            calls.push(["query", ref, order]);
            return queryRef;
        },
        // Record document fetching and expose the two brother fixtures.
        async getDocs(ref) {
            calls.push(["getDocs", ref]);
            return {
                // Visit each brother document in the fixture order.
                forEach(visit) {
                    visit({ id: "firestore-2", data: /* Return the data fixture for this scenario. */ () => ({
                        uid: "uid-2", firstname: "Zoe", lastname: "Smith",
                        email: "zoe@example.invalid", displayName: "Zoe Smith", extra: "discarded",
                    }) });
                    visit({ id: "firestore-1", data: /* Return the data fixture for this scenario. */ () => ({
                        uid: "uid-1", firstname: "Ada", lastname: "Jones",
                        email: "ada@example.invalid", displayName: "Ada Jones",
                    }) });
                },
            };
        },
        // Fail if the successful directory query logs an error.
        logError() { assert.fail("Successful query must not log an error"); },
    });

    assert.deepEqual(calls, [
        ["collection", database, "brothers"],
        ["orderBy", "firstname"],
        ["query", collectionRef, ordering],
        ["getDocs", queryRef],
    ]);
    assert.deepEqual(brothers, [
        { _id: "firestore-2", uid: "uid-2", firstname: "Zoe", lastname: "Smith", email: "zoe@example.invalid", displayName: "Zoe Smith" },
        { _id: "firestore-1", uid: "uid-1", firstname: "Ada", lastname: "Jones", email: "ada@example.invalid", displayName: "Ada Jones" },
    ]);
});

test("brother directory logs a failed query and returns an empty list", async () => {
    // Verify brother directory logs a failed query and returns an empty list.
    const error = new Error("offline");
    const logged = [];
    const brothers = await loadBrotherDirectory({
        db: {},
        // Return the collection fixture for this scenario.
        collection: () => ({}),
        // Return the order by fixture for this scenario.
        orderBy: () => ({}),
        // Return the query fixture for this scenario.
        query: () => ({}),
        // Simulate a dependency failure for this scenario.
        getDocs: async () => { throw error; },
        // Record log error calls for assertions.
        logError: (...args) => logged.push(args),
    });

    assert.deepEqual(brothers, []);
    assert.deepEqual(logged, [["Error fetching brothers:", error]]);
});
