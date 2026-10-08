import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadTsxModule } from "../helpers/loadTsxComponent.js";
import { logoutWithServices } from "../../src/features/auth/logoutWithServices.js";

const accountPath = fileURLToPath(new URL("../../src/features/auth/account.js", import.meta.url));

// Create isolated state, dependency fakes, and captured calls for this test.
function harness({ signOutError, storageError } = {}) {
    const calls = [];
    const auth = {};
    const services = {
        auth,
        // Record sign-out and optionally throw the configured error.
        signOut: async (receivedAuth) => {
            calls.push(["signOut", receivedAuth]);
            if (signOutError) throw signOutError;
        },
        // Record stored-user removal and optionally simulate a storage error.
        removeStoredUser: () => {
            calls.push(["remove", "user"]);
            if (storageError) throw storageError;
        },
        logger: { error: /* Record error calls for assertions. */ (...args) => calls.push(["error", ...args]) },
    };
    return { calls, auth, services };
}

test("logout removes the stored user only after Firebase sign-out", async () => {
    // Verify logout removes the stored user only after Firebase sign-out.
    const { calls, auth, services } = harness();
    assert.equal(await logoutWithServices(services), true);
    assert.deepEqual(calls, [["signOut", auth], ["remove", "user"]]);
});

test("failed sign-out retains the stored user and logs the original error", async () => {
    // Verify failed sign-out retains the stored user and logs the original error.
    const failure = Error("offline");
    const { calls, auth, services } = harness({ signOutError: failure });
    assert.equal(await logoutWithServices(services), false);
    assert.deepEqual(calls, [
        ["signOut", auth], ["error", "Logout error:", failure],
    ]);
});

test("storage removal failures still return false after sign-out", async () => {
    // Verify storage removal failures still return false after sign-out.
    const failure = Error("storage unavailable");
    const { calls, auth, services } = harness({ storageError: failure });
    assert.equal(await logoutWithServices(services), false);
    assert.deepEqual(calls, [
        ["signOut", auth], ["remove", "user"], ["error", "Logout error:", failure],
    ]);
});

test("the public logout call removes the user key after Firebase sign-out", async () => {
    // Verify the public logout call removes the user key after Firebase sign-out.
    const calls = [];
    const auth = {};
    const account = await loadTsxModule(accountPath, {
        "react-toastify": { toast: {} },
        "react-toastify/dist/ReactToastify.css": {},
        "../../firebase": {
            auth,
            // Record sign out calls for assertions.
            signOut: async (receivedAuth) => calls.push(["signOut", receivedAuth]),
        },
        "../../data/allowedEmails": {},
        "./checkRushAppAccess": {},
        "./createAccountWithServices": {},
        "./errorMessages": {},
        "./loginWithServices": {},
        "./logoutWithServices": { logoutWithServices },
        "./resetPasswordWithServices": {},
    }, {
        localStorage: { removeItem: /* Record remove item calls for assertions. */ (key) => calls.push(["remove", key]) },
    });

    assert.equal(await account.logout(), true);
    assert.deepEqual(calls, [["signOut", auth], ["remove", "user"]]);
});
