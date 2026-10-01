import assert from "node:assert/strict";
import test from "node:test";
import { createdStoredUser, loginStoredUser } from "../src/features/auth/userSession.js";
import {
    accountErrorMessage,
    loginErrorMessage,
    resetErrorMessage,
} from "../src/features/auth/errorMessages.js";

test("login storage keeps legacy and current name fields and split behavior", () => {
    assert.deepEqual(loginStoredUser({
        uid: "brother-1", email: "ada@example.org", displayName: "Ada  Lovelace",
    }), {
        _id: "brother-1", uid: "brother-1", email: "ada@example.org",
        displayName: "Ada  Lovelace", firstname: "Ada", lastname: " Lovelace",
        firstName: "Ada", lastName: " Lovelace",
    });

    assert.equal(JSON.stringify(loginStoredUser({ uid: "brother-2", email: "b@example.org" })),
        '{"_id":"brother-2","uid":"brother-2","email":"b@example.org","firstname":"","lastname":"","firstName":"","lastName":""}');
});

test("account storage retains provided names and empty-name fallbacks", () => {
    assert.deepEqual(createdStoredUser(
        { uid: "brother-1", email: "ada@example.org" },
        { firstName: "Ada", lastName: "Lovelace" },
        "Ada Lovelace"
    ), {
        _id: "brother-1", uid: "brother-1", email: "ada@example.org",
        displayName: "Ada Lovelace", firstname: "Ada", lastname: "Lovelace",
        firstName: "Ada", lastName: "Lovelace",
    });
    assert.equal(createdStoredUser({ uid: "u" }, {}, "").firstname, "");
});

test("auth errors preserve each displayed message and the generic fallback", () => {
    assert.deepEqual([
        loginErrorMessage("auth/invalid-email"),
        loginErrorMessage("auth/user-disabled"),
        loginErrorMessage("auth/user-not-found"),
        loginErrorMessage("auth/wrong-password"),
        loginErrorMessage("auth/invalid-credential"),
        loginErrorMessage("auth/too-many-requests"),
    ], [
        "Invalid email address", "This account has been disabled",
        "No account found with this email", "Incorrect password",
        "Invalid email or password", "Too many failed attempts. Please try again later",
    ]);
    assert.deepEqual([
        accountErrorMessage("auth/email-already-in-use"),
        accountErrorMessage("auth/invalid-email"),
        accountErrorMessage("auth/operation-not-allowed"),
        accountErrorMessage("auth/weak-password"),
    ], [
        "An account with this email already exists", "Invalid email address",
        "Email/password accounts are not enabled", "Password is too weak. Use at least 6 characters",
    ]);
    assert.equal(resetErrorMessage("auth/invalid-email"), "Invalid email address");
    assert.equal(resetErrorMessage("auth/user-not-found"), "No account found with this email");
    for (const mapper of [loginErrorMessage, accountErrorMessage, resetErrorMessage]) {
        assert.equal(mapper("other"), "Some error occurred. Try again later");
    }
});
