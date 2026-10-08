import assert from "node:assert/strict";
import test from "node:test";
import { loadDashboardData } from "../../src/features/dashboard/loadDashboardData.js";

// Build dashboard dependencies with recorded requests and state updates.
function dependencies(overrides = {}) {
    const calls = [];
    const setters = Object.fromEntries([
        "setLoading", "setBrotherData", "setShowAvailabilityModal", "setRushees",
        "setFilteredRushees", "setErrorDescription", "setError",
    ].map(
        /* Return the fixture for this scenario. */
        name => [name,
        /* Record callback arguments for assertions. */
        value => calls.push([name, value])]));

    return {
        calls,
        config: {
            // Return true from this dependency stub.
            verifyUser: async () => true,
            // Record navigate calls for assertions.
            navigate: path => calls.push(["navigate", path]),
            auth: { currentUser: { uid: "brother-1", email: "ada@example.org" } },
            db: {},
            // Return the doc fixture for this scenario.
            doc: (_db, collection, uid) => ({ collection, uid }),
            // Return the doc fixture for this scenario.
            getDoc: async () => ({ exists:
                /* Return true from this dependency stub. */
                () => true, data:
                /* Return the data fixture for this scenario. */
                () => ({ firstName: "Ada" }) }),
            axios: {
                // Record availability lookup and return a required-form response.
                post: async (url, payload) => {
                    calls.push(["post", url, payload]);
                    return { data: { status: "success", needs_form: true } };
                },
                // Record rushee lookup and return the directory fixture.
                get: async url => {
                    calls.push(["get", url]);
                    return { data: { status: "success", payload: [1, 2] } };
                },
            },
            api: "/api",
            // Invoke [...values].reverse with the test inputs.
            shuffleArray: values => [...values].reverse(),
            ...setters,
            ...overrides,
        },
    };
}

test("dashboard loading checks availability before fetching and shuffling rushees", async () => {
    // Verify dashboard loading checks availability before fetching and shuffling rushees.
    const { calls, config } = dependencies();
    await loadDashboardData(config);

    assert.deepEqual(calls, [
        ["setLoading", true],
        ["setBrotherData", { uid: "brother-1", email: "ada@example.org", firstName: "Ada" }],
        ["post", "/api/brother/pis-availability/check", { brother_uid: "brother-1" }],
        ["setShowAvailabilityModal", true],
        ["get", "/api/rushee/get-rushees"],
        ["setRushees", [2, 1]],
        ["setFilteredRushees", [2, 1]],
        ["setLoading", false],
    ]);
    assert.equal(calls[5][1], calls[6][1]);
});

test("failed verification still navigates and continues the current fetch sequence", async () => {
    // Verify failed verification still navigates and continues the current fetch sequence.
    const { calls, config } = dependencies({
        // Return false from this dependency stub.
        verifyUser: async () => false,
        auth: { currentUser: null },
    });
    await loadDashboardData(config);

    assert.deepEqual(calls.map(/* Return name to the caller. */ ([name]) => name), [
        "setLoading", "navigate", "get", "setRushees", "setFilteredRushees", "setLoading",
    ]);
    assert.equal(calls[1][1], "/");
});

test("missing Firestore profiles retain the empty-name fallback", async () => {
    // Verify missing Firestore profiles retain the empty-name fallback.
    const { calls, config } = dependencies({
        // Return the doc fixture for this scenario.
        getDoc: async () => ({ exists: /* Return false from this dependency stub. */ () => false }),
    });
    await loadDashboardData(config);

    assert.deepEqual(calls[1], ["setBrotherData", {
        uid: "brother-1", email: "ada@example.org", firstName: "", lastName: "",
    }]);
});

test("verification and rushee-fetch errors keep their distinct messages", async () => {
    // Verify verification and rushee-fetch errors keep their distinct messages.
    const verification = dependencies({ verifyUser: async () => {
        // Simulate a dependency failure for this scenario.
         throw new Error("invalid"); } });
    await loadDashboardData(verification.config);
    assert.deepEqual(verification.calls, [
        ["setLoading", true],
        ["setErrorDescription", "There was an error verifying your credentials."],
        ["setError", true],
        ["setLoading", false],
    ]);

    const fetchFailure = dependencies({
        auth: { currentUser: null },
        axios: { get: async () => {
            // Simulate a dependency failure for this scenario.
             throw new Error("offline"); } },
    });
    await loadDashboardData(fetchFailure.config);
    assert.deepEqual(fetchFailure.calls, [
        ["setLoading", true],
        ["setErrorDescription", "There was some network error while fetching the rushees."],
        ["setError", true],
        ["setLoading", false],
    ]);
});

test("an unsuccessful rushee response keeps its non-network error message", async () => {
    // Verify an unsuccessful rushee response keeps its non-network error message.
    const { calls, config } = dependencies({
        auth: { currentUser: null },
        axios: { get: /* Return the get fixture for this scenario. */ async () => ({ data: { status: "error" } }) },
    });
    await loadDashboardData(config);

    assert.deepEqual(calls, [
        ["setLoading", true],
        ["setErrorDescription", "There was some issue fetching the rushees"],
        ["setError", true],
        ["setLoading", false],
    ]);
});
