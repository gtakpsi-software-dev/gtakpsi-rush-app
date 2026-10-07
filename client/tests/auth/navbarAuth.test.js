import assert from "node:assert/strict";
import test from "node:test";

import { loadNavbarAuth } from "../../src/features/navigation/loadNavbarAuth.js";

function setup({ verified = true, user = { email: "ADA@EXAMPLE.ORG" }, claims = {},
    allowlist = [], failure } = {}) {
    const calls = [];
    const auth = {
        get currentUser() {
            calls.push(["currentUser"]);
            if (!user) return null;
            return {
                ...user,
                async getIdTokenResult(forceRefresh) {
                    calls.push(["token", forceRefresh]);
                    if (failure === "token") throw new Error("token failed");
                    return { claims };
                },
            };
        },
    };
    const options = {
        async verifyUser() {
            calls.push(["verify"]);
            if (failure === "verify") throw new Error("verification failed");
            return verified;
        },
        auth,
        allowlist,
        setIsAuthenticated: (value) => calls.push(["authenticated", value]),
        setIsAdmin: (value) => calls.push(["admin", value]),
        setIsBidcom: (value) => calls.push(["bidcom", value]),
        setIsLoading: (value) => calls.push(["loading", value]),
    };
    return { calls, options };
}

test("navbar auth preserves verification, token refresh, role, and loading order", async () => {
    const { calls, options } = setup({ claims: { admin: true, bidcom: true } });
    await loadNavbarAuth(options);
    assert.deepEqual(calls, [
        ["verify"], ["authenticated", true], ["currentUser"], ["token", true],
        ["admin", true], ["bidcom", true], ["loading", false],
    ]);
});

test("allowlisted email and false verification retain the existing role checks", async () => {
    const { calls, options } = setup({ verified: false, allowlist: ["ada@example.org"] });
    await loadNavbarAuth(options);
    assert.deepEqual(calls, [
        ["verify"], ["authenticated", false], ["currentUser"], ["token", true],
        ["admin", true], ["bidcom", false], ["loading", false],
    ]);
});

test("no current user leaves role state untouched", async () => {
    const { calls, options } = setup({ user: null });
    await loadNavbarAuth(options);
    assert.deepEqual(calls, [
        ["verify"], ["authenticated", true], ["currentUser"], ["loading", false],
    ]);
});

test("verification and token failures retain fail-closed state order", async () => {
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
    const { calls, options } = setup({ user: {} });
    await loadNavbarAuth(options);
    assert.deepEqual(calls.at(-3), ["admin", ""]);
});
