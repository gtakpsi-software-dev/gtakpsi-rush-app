import assert from "node:assert/strict";
import test from "node:test";

import { createAccountWithServices } from "../../src/features/auth/createAccountWithServices.js";

function services(overrides = {}) {
    const calls = [];
    const auth = {};
    const db = {};
    const docRef = {};
    const user = { uid: "brother-1", email: "brother@example.invalid" };

    return {
        calls,
        user,
        docRef,
        dependencies: {
            isEmailAllowed: (email) => {
                calls.push(["allowed", email]);
                return true;
            },
            auth,
            async createUserWithEmailAndPassword(receivedAuth, email, password) {
                calls.push(["create", receivedAuth, email, password]);
                return { user };
            },
            async updateProfile(...args) { calls.push(["profile", ...args]); },
            db,
            doc(...args) {
                calls.push(["doc", ...args]);
                return docRef;
            },
            async setDoc(...args) { calls.push(["setDoc", ...args]); },
            storeUser: (...args) => calls.push(["store", ...args]),
            toast: {
                success: (...args) => calls.push(["success", ...args]),
                error: (...args) => calls.push(["error", ...args]),
            },
            logger: { error: (...args) => calls.push(["logError", ...args]) },
            ...overrides,
        },
    };
}

test("account creation rejects unlisted email before Firebase writes", async () => {
    const { calls, dependencies } = services({ isEmailAllowed: (email) => {
        calls.push(["allowed", email]);
        return false;
    } });

    assert.equal(await createAccountWithServices({ email: "visitor@example.invalid" }, dependencies), false);
    assert.deepEqual(calls.map(([kind]) => kind), ["allowed", "error"]);
    assert.equal(calls[1][1], "This email is not authorized to create an account. Only GT AKPsi brothers can register.");
    assert.deepEqual(calls[1][2], {
        position: "top-center", autoClose: 5000, hideProgressBar: false,
        closeOnClick: true, pauseOnHover: true, draggable: true, theme: "dark",
    });
});

test("account creation writes profile and Firestore before local session", async () => {
    const { calls, user, docRef, dependencies } = services();
    const credentials = {
        email: user.email, pwd: "secret", firstName: "Ada", lastName: "Lovelace",
    };
    assert.equal(await createAccountWithServices(credentials, dependencies), true);

    assert.deepEqual(calls.map(([kind]) => kind), [
        "allowed", "create", "profile", "doc", "setDoc", "store", "success",
    ]);
    assert.deepEqual(calls[1], ["create", dependencies.auth, user.email, "secret"]);
    assert.deepEqual(calls[2], ["profile", user, { displayName: "Ada Lovelace" }]);
    assert.deepEqual(calls[3], ["doc", dependencies.db, "brothers", user.uid]);
    assert.equal(calls[4][1], docRef);
    assert.deepEqual({ ...calls[4][2], createdAt: undefined }, {
        uid: user.uid, email: user.email, firstname: "Ada", lastname: "Lovelace",
        displayName: "Ada Lovelace", createdAt: undefined,
    });
    assert.equal(Number.isNaN(Date.parse(calls[4][2].createdAt)), false);
    assert.deepEqual(calls[5], ["store", "user", JSON.stringify({
        _id: user.uid, uid: user.uid, email: user.email,
        displayName: "Ada Lovelace", firstname: "Ada", lastname: "Lovelace",
        firstName: "Ada", lastName: "Lovelace",
    })]);
    assert.equal(calls[6][1], "Account created successfully!");
});

test("empty account names skip profile update but keep the stored blank fields", async () => {
    const { calls, user, dependencies } = services();
    assert.equal(await createAccountWithServices({ email: user.email, pwd: "secret" }, dependencies), true);
    assert.deepEqual(calls.map(([kind]) => kind), [
        "allowed", "create", "doc", "setDoc", "store", "success",
    ]);
    assert.equal(calls[3][2].displayName, "");
    assert.equal(calls[3][2].firstname, "");
    assert.equal(calls[3][2].lastname, "");
    const stored = JSON.parse(calls[4][2]);
    assert.equal(stored.firstName, "");
    assert.equal(stored.lastName, "");
});

test("a Firestore write failure logs and shows the original error without storing a session", async () => {
    const error = Object.assign(new Error("write rejected"), { code: "auth/email-already-in-use" });
    const { calls, user, dependencies } = services({
        setDoc: async () => { throw error; },
    });

    assert.equal(await createAccountWithServices({ email: user.email, pwd: "secret" }, dependencies), false);
    assert.deepEqual(calls.map(([kind]) => kind), [
        "allowed", "create", "doc", "logError", "error",
    ]);
    assert.deepEqual(calls[3], ["logError", "Create account error:", error]);
    assert.equal(calls[4][1], "An account with this email already exists");
});
