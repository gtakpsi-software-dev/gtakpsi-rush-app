import assert from "node:assert/strict";
import test from "node:test";
import { checkRushAppAccess } from "../../src/features/auth/checkRushAppAccess.js";

// Create isolated state, dependency fakes, and captured calls for this test.
function setup(accessData = { status: "success", allowed: true }) {
    const calls = [];
    const auth = {};
    const config = {
        user: { uid: "brother-1" },
        isAdmin: true,
        isBidcom: false,
        apiBase: "/api",
        // Return the fixed api key fixture.
        getApiKey: () => "key",
        // Record the access request and return the configured JSON response.
        fetchRequest: async (url, options) => {
            calls.push(["fetch", url, options]);
            return { json: /* Return access data to the caller. */ async () => accessData };
        },
        // Record sign out calls for assertions.
        signOut: async receivedAuth => calls.push(["signOut", receivedAuth]),
        auth,
        // Record remove stored user calls for assertions.
        removeStoredUser: () => calls.push(["removeStoredUser"]),
        toast: { error: /* Record error calls for assertions. */ (message, options) => calls.push(["toast", message, options]) },
        logger: { log:
            /* Provide an inert log stub for this test. */
            () => {}, warn:
            /* Record warn calls for assertions. */
            (message, error) => calls.push(["warn", message, error]) },
    };
    return { calls, config, auth };
}

test("access check sends the existing claim and API-key request shape", async () => {
    // Verify access check sends the existing claim and API-key request shape.
    const { calls, config } = setup();
    assert.equal(await checkRushAppAccess(config), true);
    assert.deepEqual(calls, [["fetch", "/api/brother/rush-app/check-access", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": "key" },
        body: '{"uid":"brother-1","is_admin":true,"is_bidcom":false}',
    }]]);

    const withoutKey = setup({ status: "error", allowed: false });
    withoutKey.config.getApiKey = /* Return the fixed string fixture. */ () => "";
    assert.equal(await checkRushAppAccess(withoutKey.config), true);
    assert.deepEqual(withoutKey.calls[0][2].headers, { "Content-Type": "application/json" });
});

test("explicit denial signs out, removes stored user, and shows the server reason", async () => {
    // Verify explicit denial signs out, removes stored user, and shows the server reason.
    const { calls, config, auth } = setup({ status: "success", allowed: false, reason: "Paused" });
    assert.equal(await checkRushAppAccess(config), false);
    assert.deepEqual(calls.map(/* Return name to the caller. */ ([name]) => name), ["fetch", "signOut", "removeStoredUser", "toast"]);
    assert.equal(calls[1][1], auth);
    assert.equal(calls[3][1], "Paused");
    assert.deepEqual(calls[3][2], {
        position: "top-center", autoClose: 6000, hideProgressBar: false,
        closeOnClick: true, pauseOnHover: true, draggable: true, theme: "dark",
    });
});

test("transport and sign-out errors retain the current fail-open behavior", async () => {
    // Verify transport and sign-out errors retain the current fail-open behavior.
    const transport = setup();
    transport.config.fetchRequest = async () => {
        // Simulate a dependency failure for this scenario.
         throw new Error("offline"); };
    assert.equal(await checkRushAppAccess(transport.config), true);
    assert.equal(transport.calls[0][0], "warn");
    assert.equal(transport.calls[0][1], "Could not check Rush App access status:");
    assert.equal(transport.calls[0][2].message, "offline");

    const denied = setup({ status: "success", allowed: false });
    denied.config.signOut = async () => {
        // Simulate a dependency failure for this scenario.
         throw new Error("sign-out failed"); };
    assert.equal(await checkRushAppAccess(denied.config), true);
    assert.deepEqual(denied.calls.map(/* Return name to the caller. */ ([name]) => name), ["fetch", "warn"]);
});
