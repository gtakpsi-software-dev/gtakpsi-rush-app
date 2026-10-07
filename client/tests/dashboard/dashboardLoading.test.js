import assert from "node:assert/strict";
import test from "node:test";
import { loadDashboardData } from "../../src/features/dashboard/loadDashboardData.js";

function dependencies(overrides = {}) {
    const calls = [];
    const setters = Object.fromEntries([
        "setLoading", "setBrotherData", "setShowAvailabilityModal", "setRushees",
        "setFilteredRushees", "setErrorDescription", "setError",
    ].map(name => [name, value => calls.push([name, value])]));

    return {
        calls,
        config: {
            verifyUser: async () => true,
            navigate: path => calls.push(["navigate", path]),
            auth: { currentUser: { uid: "brother-1", email: "ada@example.org" } },
            db: {},
            doc: (_db, collection, uid) => ({ collection, uid }),
            getDoc: async () => ({ exists: () => true, data: () => ({ firstName: "Ada" }) }),
            axios: {
                post: async (url, payload) => {
                    calls.push(["post", url, payload]);
                    return { data: { status: "success", needs_form: true } };
                },
                get: async url => {
                    calls.push(["get", url]);
                    return { data: { status: "success", payload: [1, 2] } };
                },
            },
            api: "/api",
            shuffleArray: values => [...values].reverse(),
            ...setters,
            ...overrides,
        },
    };
}

test("dashboard loading checks availability before fetching and shuffling rushees", async () => {
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
    const { calls, config } = dependencies({
        verifyUser: async () => false,
        auth: { currentUser: null },
    });
    await loadDashboardData(config);

    assert.deepEqual(calls.map(([name]) => name), [
        "setLoading", "navigate", "get", "setRushees", "setFilteredRushees", "setLoading",
    ]);
    assert.equal(calls[1][1], "/");
});

test("missing Firestore profiles retain the empty-name fallback", async () => {
    const { calls, config } = dependencies({
        getDoc: async () => ({ exists: () => false }),
    });
    await loadDashboardData(config);

    assert.deepEqual(calls[1], ["setBrotherData", {
        uid: "brother-1", email: "ada@example.org", firstName: "", lastName: "",
    }]);
});

test("verification and rushee-fetch errors keep their distinct messages", async () => {
    const verification = dependencies({ verifyUser: async () => { throw new Error("invalid"); } });
    await loadDashboardData(verification.config);
    assert.deepEqual(verification.calls, [
        ["setLoading", true],
        ["setErrorDescription", "There was an error verifying your credentials."],
        ["setError", true],
        ["setLoading", false],
    ]);

    const fetchFailure = dependencies({
        auth: { currentUser: null },
        axios: { get: async () => { throw new Error("offline"); } },
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
    const { calls, config } = dependencies({
        auth: { currentUser: null },
        axios: { get: async () => ({ data: { status: "error" } }) },
    });
    await loadDashboardData(config);

    assert.deepEqual(calls, [
        ["setLoading", true],
        ["setErrorDescription", "There was some issue fetching the rushees"],
        ["setError", true],
        ["setLoading", false],
    ]);
});
