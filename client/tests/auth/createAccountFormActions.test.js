import assert from "node:assert/strict";
import test from "node:test";

import { createAccountFormActions } from "../../src/features/auth/createAccountFormActions.js";

const valid = {
    firstName: "Ada", lastName: "Lovelace", email: "ada@example.edu",
    password: "secret", confirmPassword: "secret",
};
const toastOptions = { position: "top-center", autoClose: 5000, theme: "dark" };

// Create isolated state, dependency fakes, and captured calls for this test.
function harness(values = valid, createResult = true) {
    const calls = [];
    // Return the ref fixture for this scenario.
    const ref = (key) => ({ current: { value: values[key] } });
    const actions = createAccountFormActions({
        firstName: ref("firstName"),
        lastName: ref("lastName"),
        email: ref("email"),
        password: ref("password"),
        confirmPassword: ref("confirmPassword"),
        toast: { error: /* Record error calls for assertions. */ (...args) => calls.push(["error", ...args]) },
        // Record set loading calls for assertions.
        setLoading: (value) => calls.push(["loading", value]),
        // Record account creation and return the configured result.
        createAccount: async (payload) => {
            calls.push(["create", payload]);
            return createResult;
        },
        // Record navigate calls for assertions.
        navigate: (path) => calls.push(["navigate", path]),
    });
    return { calls, actions };
}

for (const [values, message] of [
    [{ firstName: "", lastName: "", email: "", password: "", confirmPassword: "" },
        "Please enter your first and last name"],
    [{ ...valid, email: "" }, "Please enter your email"],
    [{ ...valid, password: "" }, "Please enter a password"],
    [{ ...valid, confirmPassword: "different" }, "Passwords do not match"],
    [{ ...valid, password: "short", confirmPassword: "short" },
        "Password must be at least 6 characters"],
]) {
    test(`account form rejects ${message.toLowerCase()} before creating an account`, async () => {
        // Verify that invalid account fields produce the expected error message.
        const { calls, actions } = harness(values);
        await actions.handleCreateAccount();
        assert.deepEqual(calls, [["error", message, toastOptions]]);
    });
}

test("valid account creation preserves loading, payload, and success navigation order", async () => {
    // Verify valid account creation preserves loading, payload, and success navigation order.
    const { calls, actions } = harness();
    await actions.handleCreateAccount();
    assert.deepEqual(calls, [
        ["loading", true],
        ["create", {
            firstName: "Ada", lastName: "Lovelace", email: "ada@example.edu", pwd: "secret",
        }],
        ["loading", false],
        ["navigate", "/dashboard"],
    ]);
});

test("failed account creation clears loading without navigating", async () => {
    // Verify failed account creation clears loading without navigating.
    const { calls, actions } = harness(valid, false);
    await actions.handleCreateAccount();
    assert.deepEqual(calls.map(/* Return kind to the caller. */ ([kind]) => kind), ["loading", "create", "loading"]);
});

test("Enter triggers account creation while other keys do nothing", async () => {
    // Verify Enter triggers account creation while other keys do nothing.
    const { calls, actions } = harness();
    actions.handleKeyPress({ key: "Escape" });
    assert.deepEqual(calls, []);

    assert.equal(actions.handleKeyPress({ key: "Enter" }), undefined);
    await Promise.resolve();
    assert.deepEqual(calls.map(/* Return kind to the caller. */ ([kind]) => kind), ["loading", "create", "loading", "navigate"]);
});
