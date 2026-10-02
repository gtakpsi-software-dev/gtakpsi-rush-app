import assert from "node:assert/strict";
import test from "node:test";

import { createAccountFormActions } from "../../src/features/auth/createAccountFormActions.js";

const valid = {
    firstName: "Ada", lastName: "Lovelace", email: "ada@example.edu",
    password: "secret", confirmPassword: "secret",
};
const toastOptions = { position: "top-center", autoClose: 5000, theme: "dark" };

function harness(values = valid, createResult = true) {
    const calls = [];
    const ref = (key) => ({ current: { value: values[key] } });
    const actions = createAccountFormActions({
        firstName: ref("firstName"),
        lastName: ref("lastName"),
        email: ref("email"),
        password: ref("password"),
        confirmPassword: ref("confirmPassword"),
        toast: { error: (...args) => calls.push(["error", ...args]) },
        setLoading: (value) => calls.push(["loading", value]),
        createAccount: async (payload) => {
            calls.push(["create", payload]);
            return createResult;
        },
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
        const { calls, actions } = harness(values);
        await actions.handleCreateAccount();
        assert.deepEqual(calls, [["error", message, toastOptions]]);
    });
}

test("valid account creation preserves loading, payload, and success navigation order", async () => {
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
    const { calls, actions } = harness(valid, false);
    await actions.handleCreateAccount();
    assert.deepEqual(calls.map(([kind]) => kind), ["loading", "create", "loading"]);
});

test("Enter triggers account creation while other keys do nothing", async () => {
    const { calls, actions } = harness();
    actions.handleKeyPress({ key: "Escape" });
    assert.deepEqual(calls, []);

    assert.equal(actions.handleKeyPress({ key: "Enter" }), undefined);
    await Promise.resolve();
    assert.deepEqual(calls.map(([kind]) => kind), ["loading", "create", "loading", "navigate"]);
});
