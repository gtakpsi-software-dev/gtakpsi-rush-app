import assert from "node:assert/strict";
import test from "node:test";

import { submitProfileChanges } from "../../../src/features/rushee/self/submitProfileChanges.js";

const original = {
    first_name: "Ada", last_name: "One", housing: "Hall", phone_number: "4045551234",
    email: "ada@example.com", gtid: "123456789", major: "Computer Science",
    class: "Third", pronouns: "she/her", image_url: "old.jpg",
};

const toastOptions = {
    position: "top-center", autoClose: 5000, hideProgressBar: false,
    closeOnClick: true, pauseOnHover: true, draggable: true,
    progress: undefined, theme: "dark",
};

// Create isolated state, dependency fakes, and captured calls for this test.
function harness(overrides = {}) {
    const events = [];
    const location = { origin: "https://rush.example", href: "unchanged" };
    const event = { preventDefault: /* Record prevent default calls for assertions. */ () => events.push(["prevent"]) };
    const deps = {
        rushee: { ...original, first_name: "Adaline" },
        initialRushee: original,
        api: "/api",
        gtid: "123456789",
        link: "access-code",
        location,
        // Record set loading calls for assertions.
        setLoading: (value) => events.push(["loading", value]),
        toast: {
            // Record error calls for assertions.
            error: (message, options) => events.push(["error", message, options]),
            // Record info calls for assertions.
            info: (message, options) => events.push(["info", message, options]),
        },
        // Record profile verification and return success.
        verifyInfo: async (...args) => { events.push(["verify", ...args]); return { status: "success" }; },
        // Record the profile update request and return success.
        post: async (...args) => { events.push(["post", ...args]); return { data: { status: "success" } }; },
        logger: { log: /* Record log calls for assertions. */ (error) => events.push(["log", error]) },
        ...overrides,
    };
    return { event, events, location, deps };
}

test("each required field rejects empty input before preventing submit", async () => {
    // Verify each required field rejects empty input before preventing submit.
    const required = [
        "first_name", "last_name", "housing", "phone_number", "email",
        "gtid", "major", "class", "pronouns",
    ];
    for (const field of required) {
        const { event, events, deps } = harness({ rushee: { ...original, [field]: "" } });
        await submitProfileChanges(event, deps);
        assert.deepEqual(events, [
            ["loading", true], ["error", "Fields cannot be empty", toastOptions],
        ], field);
    }
});

test("missing initial record and unchanged edits retain early-return loading state", async () => {
    // Verify missing initial record and unchanged edits retain early-return loading state.
    const missing = harness({ initialRushee: null });
    await submitProfileChanges(missing.event, missing.deps);
    assert.deepEqual(missing.events, [
        ["loading", true], ["prevent"],
        ["error", "Unable to parse changes", toastOptions],
    ]);

    const unchanged = harness({ rushee: { ...original } });
    await submitProfileChanges(unchanged.event, unchanged.deps);
    assert.deepEqual(unchanged.events, [
        ["loading", true], ["prevent"],
        ["info", "No changes were made", toastOptions],
    ]);
});

test("changed fields keep object-key order and the GTID verification flag", async () => {
    // Verify changed fields keep object-key order and the GTID verification flag.
    const rushee = { ...original, first_name: "Adaline", gtid: "987654321", image_url: "new.jpg" };
    const { event, events, deps, location } = harness({ rushee });
    await submitProfileChanges(event, deps);
    assert.deepEqual(events, [
        ["loading", true], ["prevent"],
        ["verify", "987654321", "ada@example.com", "4045551234", true],
        ["post", "/api/rushee/update-rushee/123456789", [
            { field: "first_name", new_value: "Adaline" },
            { field: "gtid", new_value: "987654321" },
            { field: "image_url", new_value: "new.jpg" },
        ]],
        ["loading", false],
    ]);
    assert.equal(location.href, "https://rush.example/rushee/987654321/access-code");
});

test("verification errors and exceptions stop before the update request", async () => {
    // Verify verification errors and exceptions stop before the update request.
    const invalid = harness({
        // Record profile verification and reject the invalid GTID.
        verifyInfo: async (...args) => {
            invalid.events.push(["verify", ...args]);
            return { status: "error", message: "Invalid GTID" };
        },
    });
    await submitProfileChanges(invalid.event, invalid.deps);
    assert.deepEqual(invalid.events, [
        ["loading", true], ["prevent"],
        ["verify", "123456789", "ada@example.com", "4045551234", false],
        ["error", "Invalid GTID", toastOptions],
    ]);

    const failure = new Error("offline");
    const rejected = harness({ verifyInfo: async () => {
        // Simulate a dependency failure for this scenario.
         throw failure; } });
    await submitProfileChanges(rejected.event, rejected.deps);
    assert.deepEqual(rejected.events, [
        ["loading", true], ["prevent"], ["log", failure],
        ["error", "Failed to update rushee", toastOptions],
    ]);
});

test("unsuccessful updates show the response message and clear loading", async () => {
    // Verify unsuccessful updates show the response message and clear loading.
    const { event, events, deps, location } = harness({
        // Record the profile update request and return access denial.
        post: async (...args) => {
            events.push(["post", ...args]);
            return { data: { status: "error", message: "Denied" } };
        },
    });
    await submitProfileChanges(event, deps);
    assert.deepEqual(events.slice(-2), [
        ["error", "Denied", toastOptions], ["loading", false],
    ]);
    assert.equal(location.href, "unchanged");
});

test("update request failures keep server-message and fallback behavior", async () => {
    // Verify update request failures keep server-message and fallback behavior.
    for (const [error, message] of [
        [{ response: { data: { message: "Conflict" } } }, "Conflict"],
        [new Error("offline"), "Failed to update rushee"],
    ]) {
        const rejected = harness({ post: async () => {
            // Simulate a dependency failure for this scenario.
             throw error; } });
        await submitProfileChanges(rejected.event, rejected.deps);
        assert.deepEqual(rejected.events.slice(-2), [
            ["error", message, toastOptions], ["loading", false],
        ]);
        assert.equal(rejected.location.href, "unchanged");
    }
});

test("a missing rushee retains the original required-field access failure", async () => {
    // Verify a missing rushee retains the original required-field access failure.
    const { event, events, deps } = harness({ rushee: null });
    await assert.rejects(submitProfileChanges(event, deps), TypeError);
    assert.deepEqual(events, [["loading", true]]);
});
