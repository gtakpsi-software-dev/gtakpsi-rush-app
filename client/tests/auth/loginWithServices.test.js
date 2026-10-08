import assert from "node:assert/strict";
import test from "node:test";

import { loginWithServices } from "../../src/features/auth/loginWithServices.js";

// Build login service fakes with recorded calls and optional overrides.
function services(overrides = {}) {
    const calls = [];
    const auth = {};
    const user = {
        uid: "brother-1",
        email: "ada@example.invalid",
        displayName: "Ada Lovelace",
        // Record token refresh and return the role claims fixture.
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
            // Record login credentials and return the authenticated user fixture.
            async signInWithEmailAndPassword(receivedAuth, email, password) {
                calls.push(["signIn", receivedAuth, email, password]);
                return { user };
            },
            // Fail if login directly signs out instead of delegating to the access check.
            signOut() { assert.fail("Sign-out belongs to the access check"); },
            // Record the access check and allow login.
            async checkRushAppAccess(options) {
                calls.push(["access", options]);
                return true;
            },
            // Record prefix lookup and return the test API path.
            getApiPrefix() {
                calls.push(["apiPrefix"]);
                return "/api";
            },
            // Return the fixed api key fixture.
            getApiKey: () => "key",
            // Fail if login fetches access settings outside the access-check helper.
            fetchRequest() { assert.fail("Fetch belongs to the access check"); },
            // Record store user calls for assertions.
            storeUser: (...args) => calls.push(["store", ...args]),
            // Fail if successful login removes the stored user.
            removeStoredUser() { assert.fail("Access was not denied"); },
            toast: {
                // Record success calls for assertions.
                success: (...args) => calls.push(["success", ...args]),
                // Record error calls for assertions.
                error: (...args) => calls.push(["error", ...args]),
            },
            logger: {
                // Record log calls for assertions.
                log: (...args) => calls.push(["log", ...args]),
                // Record error calls for assertions.
                error: (...args) => calls.push(["logError", ...args]),
            },
            ...overrides,
        },
    };
}

test("login checks fresh claims and access before storing the user", async () => {
    // Verify login checks fresh claims and access before storing the user.
    const { calls, user, dependencies } = services();
    assert.equal(await loginWithServices({ email: user.email, pwd: "secret" }, dependencies), true);

    assert.deepEqual(calls.map(/* Return kind to the caller. */ ([kind]) => kind), [
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
    // Verify explicit access denial does not store or announce a successful login.
    const { calls, dependencies } = services({
        // Record the access denial and reject login.
        checkRushAppAccess: async () => {
            calls.push(["accessDenied"]);
            return false;
        },
    });

    assert.equal(await loginWithServices({ email: "ada@example.invalid", pwd: "secret" }, dependencies), false);
    assert.deepEqual(calls.map(/* Return kind to the caller. */ ([kind]) => kind), ["signIn", "token", "log", "apiPrefix", "accessDenied"]);
});

test("sign-in failures keep the mapped error toast and skip access checks", async () => {
    // Verify sign-in failures keep the mapped error toast and skip access checks.
    const error = Object.assign(new Error("rejected"), { code: "auth/wrong-password" });
    const { calls, dependencies } = services({
        // Simulate a dependency failure for this scenario.
        signInWithEmailAndPassword: async () => { throw error; },
    });

    assert.equal(await loginWithServices({ email: "ada@example.invalid", pwd: "wrong" }, dependencies), false);
    assert.deepEqual(calls.map(/* Return kind to the caller. */ ([kind]) => kind), ["logError", "error"]);
    assert.deepEqual(calls[0], ["logError", "Login error:", error]);
    assert.equal(calls[1][1], "Incorrect password");
    assert.deepEqual(calls[1][2], {
        position: "top-center", autoClose: 5000, hideProgressBar: false,
        closeOnClick: true, pauseOnHover: true, draggable: true, theme: "dark",
    });
});
