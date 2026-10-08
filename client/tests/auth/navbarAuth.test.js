import assert from "node:assert/strict";
import test from "node:test";

import { loadNavbarAuth } from "../../src/features/navigation/loadNavbarAuth.js";

// Create isolated state, dependency fakes, and captured calls for this test.
function setup({ verified = true, user = { email: "ADA@EXAMPLE.ORG" }, claims = {},
    allowlist = [], failure } = {}) {
    const calls = [];
    const auth = {
        // Record current-user access and expose the configured user and token stub.
        get currentUser() {
            calls.push(["currentUser"]);
            if (!user) return null;
            return {
                ...user,
                // Record token refresh and simulate token failure when requested.
                async getIdTokenResult(forceRefresh) {
                    calls.push(["token", forceRefresh]);
                    if (failure === "token") throw new Error("token failed");
                    return { claims };
                },
            };
        },
    };
    const options = {
        // Record verification and return or throw its configured result.
        async verifyUser() {
            calls.push(["verify"]);
            if (failure === "verify") throw new Error("verification failed");
            return verified;
        },
        auth,
        allowlist,
        // Record set is authenticated calls for assertions.
        setIsAuthenticated: (value) => calls.push(["authenticated", value]),
        // Record set is admin calls for assertions.
        setIsAdmin: (value) => calls.push(["admin", value]),
        // Record set is bidcom calls for assertions.
        setIsBidcom: (value) => calls.push(["bidcom", value]),
        // Record set is loading calls for assertions.
        setIsLoading: (value) => calls.push(["loading", value]),
    };
    return { calls, options };
}

test("navbar auth preserves verification, token refresh, role, and loading order", async () => {
    // Verify navbar auth preserves verification, token refresh, role, and loading order.
    const { calls, options } = setup({ claims: { admin: true, bidcom: true } });
    await loadNavbarAuth(options);
    assert.deepEqual(calls, [
        ["verify"], ["authenticated", true], ["currentUser"], ["token", true],
        ["admin", true], ["bidcom", true], ["loading", false],
    ]);
});

test("allowlisted email and false verification retain the existing role checks", async () => {
    // Verify allowlisted email and false verification retain the existing role checks.
    const { calls, options } = setup({ verified: false, allowlist: ["ada@example.org"] });
    await loadNavbarAuth(options);
    assert.deepEqual(calls, [
        ["verify"], ["authenticated", false], ["currentUser"], ["token", true],
        ["admin", true], ["bidcom", false], ["loading", false],
    ]);
});

test("no current user leaves role state untouched", async () => {
    // Verify no current user leaves role state untouched.
    const { calls, options } = setup({ user: null });
    await loadNavbarAuth(options);
    assert.deepEqual(calls, [
        ["verify"], ["authenticated", true], ["currentUser"], ["loading", false],
    ]);
});

test("verification and token failures retain fail-closed state order", async () => {
    // Verify verification and token failures retain fail-closed state order.
    const verification = setup({ failure: "verify" });
    await loadNavbarAuth(verification.options);
    assert.deepEqual(verification.calls, [
        ["verify"], ["authenticated", false], ["loading", false],
    ]);

    const token = setup({ failure: "token" });
    await loadNavbarAuth(token.options);
    assert.deepEqual(token.calls, [
        ["verify"], ["authenticated", true], ["currentUser"], ["token", true],
        ["authenticated", false], ["loading", false],
    ]);
});

test("missing email retains the current falsy admin value", async () => {
    // Verify missing email retains the current falsy admin value.
    const { calls, options } = setup({ user: {} });
    await loadNavbarAuth(options);
    assert.deepEqual(calls.at(-3), ["admin", ""]);
});
