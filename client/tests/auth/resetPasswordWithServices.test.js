import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadTsxModule } from "../helpers/loadTsxComponent.js";
import { resetErrorMessage } from "../../src/features/auth/errorMessages.js";
import { resetPasswordWithServices } from "../../src/features/auth/resetPasswordWithServices.js";

const accountPath = fileURLToPath(new URL("../../src/features/auth/account.js", import.meta.url));

function harness({ failure } = {}) {
    const calls = [];
    const auth = { name: "test auth" };
    const services = {
        auth,
        sendPasswordResetEmail: async (passedAuth, email) => {
            calls.push(["send", passedAuth, email]);
            if (failure) throw failure;
        },
        toast: {
            success: (...args) => calls.push(["success", ...args]),
            error: (...args) => calls.push(["error", ...args]),
        },
        resetErrorMessage,
        logger: { error: (...args) => calls.push(["log", ...args]) },
    };
    return { calls, auth, services };
}

test("password reset sends through Firebase before showing the success toast", async () => {
    const { calls, auth, services } = harness();
    assert.equal(await resetPasswordWithServices("ada@example.edu", services), true);
    assert.deepEqual(calls, [
        ["send", auth, "ada@example.edu"],
        ["success", "Password reset email sent! Check your inbox.", {
            position: "top-center", autoClose: 5000, theme: "dark",
        }],
    ]);
});

test("password reset preserves the mapped error toast and logging order", async () => {
    const failure = { code: "auth/user-not-found" };
    const { calls, auth, services } = harness({ failure });
    assert.equal(await resetPasswordWithServices("missing@example.edu", services), false);
    assert.deepEqual(calls, [
        ["send", auth, "missing@example.edu"],
        ["log", "Password reset error:", failure],
        ["error", "No account found with this email", {
            position: "top-center", autoClose: 5000, hideProgressBar: false,
            closeOnClick: true, pauseOnHover: true, draggable: true, theme: "dark",
        }],
    ]);
});

test("unknown password reset errors retain the generic message", async () => {
    const { calls, services } = harness({ failure: { code: "auth/other" } });
    assert.equal(await resetPasswordWithServices("ada@example.edu", services), false);
    assert.equal(calls[2][1], "Some error occurred. Try again later");
});

test("the account API wires password reset to Firebase and the shared toast", async () => {
    const calls = [];
    const auth = {};
    const toast = {
        success: (...args) => calls.push(["toast", ...args]),
    };
    const account = await loadTsxModule(accountPath, {
        "react-toastify": { toast },
        "react-toastify/dist/ReactToastify.css": {},
        "../../firebase": {
            auth,
            sendPasswordResetEmail: async (...args) => calls.push(["send", ...args]),
        },
        "../../data/allowedEmails": {},
        "./errorMessages": { resetErrorMessage },
        "./checkRushAppAccess": {},
        "./loginWithServices": {},
        "./createAccountWithServices": {},
        "./logoutWithServices": {},
        "./resetPasswordWithServices": { resetPasswordWithServices },
    });

    assert.equal(await account.resetPassword("ada@example.edu"), true);
    assert.deepEqual(calls, [
        ["send", auth, "ada@example.edu"],
        ["toast", "Password reset email sent! Check your inbox.", {
            position: "top-center", autoClose: 5000, theme: "dark",
        }],
    ]);
});
