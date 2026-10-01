import assert from "node:assert/strict";
import test from "node:test";

import { loginWithServices } from "../src/features/auth/loginWithServices.js";

function services(overrides = {}) {
    const calls = [];
    const auth = {};
    const user = {
        uid: "brother-1",
        email: "ada@example.invalid",
        displayName: "Ada Lovelace",
        async getIdTokenResult(forceRefresh) {
            calls.push(["token", forceRefresh]);
            return { claims: { admin: true, bidcom: false } };
        },
    };

    return {
        calls,
        user,
        dependencies: {
            auth,
            async signInWithEmailAndPassword(receivedAuth, email, password) {
                calls.push(["signIn", receivedAuth, email, password]);
                return { user };
            },
            signOut() { assert.fail("Sign-out belongs to the access check"); },
            async checkRushAppAccess(options) {
                calls.push(["access", options]);
                return true;
            },
            getApiPrefix() {
                calls.push(["apiPrefix"]);
                return "/api";
            },
            getApiKey: () => "key",
            fetchRequest() { assert.fail("Fetch belongs to the access check"); },
            storeUser: (...args) => calls.push(["store", ...args]),
            removeStoredUser() { assert.fail("Access was not denied"); },
            toast: {
                success: (...args) => calls.push(["success", ...args]),
                error: (...args) => calls.push(["error", ...args]),
            },
            logger: {
                log: (...args) => calls.push(["log", ...args]),
                error: (...args) => calls.push(["logError", ...args]),
            },
            ...overrides,
        },
    };
}

test("login checks fresh claims and access before storing the user", async () => {
    const { calls, user, dependencies } = services();
    assert.equal(await loginWithServices({ email: user.email, pwd: "secret" }, dependencies), true);

    assert.deepEqual(calls.map(([kind]) => kind), [
        "signIn", "token", "log", "apiPrefix", "access", "store", "success",
    ]);
    assert.deepEqual(calls[0], ["signIn", dependencies.auth, user.email, "secret"]);
    assert.deepEqual(calls[2][2], {
        uid: user.uid, email: user.email,
        claims: { admin: true, bidcom: false }, isAdmin: true, isBidcom: false,
    });
    assert.equal(calls[4][1].user, user);
    assert.equal(calls[4][1].apiBase, "/api");
    assert.equal(calls[4][1].isAdmin, true);
    assert.equal(calls[4][1].isBidcom, false);
    assert.equal(calls[4][1].getApiKey(), "key");
    assert.deepEqual(calls[5], ["store", "user", JSON.stringify({
        _id: user.uid, uid: user.uid, email: user.email,
        displayName: user.displayName, firstname: "Ada", lastname: "Lovelace",
        firstName: "Ada", lastName: "Lovelace",
    })]);
    assert.equal(calls[6][1], "Signed in successfully!");
    assert.deepEqual(calls[6][2], { position: "top-center", autoClose: 3000, theme: "dark" });
});

test("explicit access denial does not store or announce a successful login", async () => {
    const { calls, dependencies } = services({
        checkRushAppAccess: async () => {
            calls.push(["accessDenied"]);
            return false;
        },
    });

    assert.equal(await loginWithServices({ email: "ada@example.invalid", pwd: "secret" }, dependencies), false);
    assert.deepEqual(calls.map(([kind]) => kind), ["signIn", "token", "log", "apiPrefix", "accessDenied"]);
});

test("sign-in failures keep the mapped error toast and skip access checks", async () => {
    const error = Object.assign(new Error("rejected"), { code: "auth/wrong-password" });
    const { calls, dependencies } = services({
        signInWithEmailAndPassword: async () => { throw error; },
    });

    assert.equal(await loginWithServices({ email: "ada@example.invalid", pwd: "wrong" }, dependencies), false);
    assert.deepEqual(calls.map(([kind]) => kind), ["logError", "error"]);
    assert.deepEqual(calls[0], ["logError", "Login error:", error]);
    assert.equal(calls[1][1], "Incorrect password");
    assert.deepEqual(calls[1][2], {
        position: "top-center", autoClose: 5000, hideProgressBar: false,
        closeOnClick: true, pauseOnHover: true, draggable: true, theme: "dark",
    });
});
