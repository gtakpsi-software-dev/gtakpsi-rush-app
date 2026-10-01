import assert from "node:assert/strict";
import test from "node:test";

import { loadBrotherDirectory } from "../src/features/brothers/loadBrotherDirectory.js";

test("brother directory keeps the Firestore query and voting fields", async () => {
    const calls = [];
    const database = {};
    const collectionRef = {};
    const ordering = {};
    const queryRef = {};
    const brothers = await loadBrotherDirectory({
        db: database,
        collection(db, name) {
            calls.push(["collection", db, name]);
            return collectionRef;
        },
        orderBy(field) {
            calls.push(["orderBy", field]);
            return ordering;
        },
        query(ref, order) {
            calls.push(["query", ref, order]);
            return queryRef;
        },
        async getDocs(ref) {
            calls.push(["getDocs", ref]);
            return {
                forEach(visit) {
                    visit({ id: "firestore-2", data: () => ({
                        uid: "uid-2", firstname: "Zoe", lastname: "Smith",
                        email: "zoe@example.invalid", displayName: "Zoe Smith", extra: "discarded",
                    }) });
                    visit({ id: "firestore-1", data: () => ({
                        uid: "uid-1", firstname: "Ada", lastname: "Jones",
                        email: "ada@example.invalid", displayName: "Ada Jones",
                    }) });
                },
            };
        },
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
    const error = new Error("offline");
    const logged = [];
    const brothers = await loadBrotherDirectory({
        db: {},
        collection: () => ({}),
        orderBy: () => ({}),
        query: () => ({}),
        getDocs: async () => { throw error; },
        logError: (...args) => logged.push(args),
    });

    assert.deepEqual(brothers, []);
    assert.deepEqual(logged, [["Error fetching brothers:", error]]);
});
