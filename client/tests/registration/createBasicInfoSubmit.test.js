import assert from "node:assert/strict";
import test from "node:test";

import { createBasicInfoSubmit } from "../../src/features/registration/createBasicInfoSubmit.js";

const warningOptions = {
    position: "top-center", autoClose: 5000, hideProgressBar: false,
    closeOnClick: false, pauseOnHover: true, draggable: true,
    progress: undefined, theme: "colored",
};

function harness(overrides = {}) {
    const events = [];
    const values = ["Ada", "Lovelace", "ada@example.invalid", "Hall", "4045550100", "900000001", "Business", "she/her", "Third Year", "Friend"];
    const inputs = values.map((value) => ({ current: { value } }));
    const fields = inputs.map((input, index) => [
        input,
        (value) => events.push(["field", index, value]),
    ]);
    const deps = {
        fields,
        gtid: inputs[5],
        email: inputs[2],
        phone: inputs[4],
        verifyInfo: async (...args) => {
            events.push(["verify", ...args]);
            return { status: "success" };
        },
        setCurrLoading: (value) => events.push(["loading", value]),
        setPage: (value) => events.push(["page", value]),
        toast: { warn: (...args) => events.push(["warn", ...args]) },
        logError: (error) => events.push(["log", error]),
        ...overrides,
    };
    return { events, inputs, deps };
}

test("valid basic info verifies GTID, email, and phone before saving fields in form order", async () => {
    const { events, deps } = harness();
    await createBasicInfoSubmit(deps)();
    assert.deepEqual(events, [
        ["loading", true],
        ["verify", "900000001", "ada@example.invalid", "4045550100", true],
        ["field", 0, "Ada"],
        ["field", 1, "Lovelace"],
        ["field", 2, "ada@example.invalid"],
        ["field", 3, "Hall"],
        ["field", 4, "4045550100"],
        ["field", 5, "900000001"],
        ["field", 6, "Business"],
        ["field", 7, "she/her"],
        ["field", 8, "Third Year"],
        ["field", 9, "Friend"],
        ["page", 1],
        ["loading", false],
    ]);
});

test("missing basic info warns before verification and retains the existing loading state", async () => {
    for (const invalid of [null, ""]) {
        const { events, inputs, deps } = harness();
        inputs[4].current.value = invalid;
        await createBasicInfoSubmit(deps)();
        assert.deepEqual(events, [
            ["loading", true], ["warn", "Fields cannot be empty", warningOptions],
        ]);
    }
});

test("verification rejection shows its message and clears loading without saving fields", async () => {
    const { events, deps } = harness({
        verifyInfo: async (...args) => {
            events.push(["verify", ...args]);
            return { status: "error", message: "Already registered" };
        },
    });
    await createBasicInfoSubmit(deps)();
    assert.deepEqual(events, [
        ["loading", true],
        ["verify", "900000001", "ada@example.invalid", "4045550100", true],
        ["warn", "Already registered", warningOptions],
        ["loading", false],
    ]);
});

test("verification failure logs and warns before clearing loading", async () => {
    const error = new Error("offline");
    const { events, deps } = harness({ verifyInfo: async () => { throw error; } });
    await createBasicInfoSubmit(deps)();
    assert.deepEqual(events, [
        ["loading", true], ["log", error],
        ["warn", "Some internal error occurred", warningOptions],
        ["loading", false],
    ]);
});

test("synchronous verification and field-setter failures keep separate cleanup paths", async () => {
    const verifyError = new Error("verification setup failed");
    const synchronous = harness({ verifyInfo: () => { throw verifyError; } });
    await assert.rejects(createBasicInfoSubmit(synchronous.deps)(), verifyError);
    assert.deepEqual(synchronous.events, [["loading", true]]);

    const setterError = new Error("field update failed");
    const setter = harness();
    setter.deps.fields[0][1] = () => { throw setterError; };
    await createBasicInfoSubmit(setter.deps)();
    assert.deepEqual(setter.events.slice(-4), [
        ["verify", "900000001", "ada@example.invalid", "4045550100", true],
        ["log", setterError],
        ["warn", "Some internal error occurred", warningOptions],
        ["loading", false],
    ]);
    assert.ok(!setter.events.some(([kind]) => kind === "page"));
});
