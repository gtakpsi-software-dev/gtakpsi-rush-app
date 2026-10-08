import assert from "node:assert/strict";
import test from "node:test";

import { loadPisPageData } from "../../src/features/pis/loadPisPageData.js";

// Create isolated state, dependency fakes, and captured calls for this test.
function harness(overrides = {}) {
    const events = [];
    const rushee = { gtid: "900000001", pis: [] };
    const questions = [{ question: "Why?" }];
    const deps = {
        // Record verification and allow the interview page to load.
        verifyUser: async () => {
            events.push(["verify"]);
            return true;
        },
        // Record navigate calls for assertions.
        navigate: (path) => events.push(["navigate", path]),
        errorTitle: "Default Error Title",
        errorDescription: "Default Error Description",
        currentUser: null,
        auth: { currentUser: { uid: "brother-1", displayName: "Ada Lovelace" } },
        // Record stored-user lookup and simulate missing browser storage.
        getStoredUser: () => {
            events.push(["storedUser"]);
            return null;
        },
        // Record set current user calls for assertions.
        setCurrentUser: (user) => events.push(["currentUser", user]),
        // Record the request and return questions or rushee details by URL.
        get: async (url) => {
            events.push(["get", url]);
            if (url.endsWith("/get-pis-questions/900000001")) {
                return { data: { status: "success", payload: {
                    available: true, reveal_at: null, questions,
                } } };
            }
            return { data: { status: "success", payload: rushee } };
        },
        api: "/api",
        gtid: "900000001",
        // Record set rushee calls for assertions.
        setRushee: (value) => events.push(["rushee", value]),
        // Record set answers calls for assertions.
        setAnswers: (updater) => events.push(["answers", updater({})]),
        // Record set brother a calls for assertions.
        setBrotherA: (value) => events.push(["brotherA", value]),
        // Record set brother b calls for assertions.
        setBrotherB: (value) => events.push(["brotherB", value]),
        // Record set questions calls for assertions.
        setQuestions: (value) => events.push(["questions", value]),
        // Record set questions available calls for assertions.
        setQuestionsAvailable: (value) => events.push(["available", value]),
        // Record set reveal at calls for assertions.
        setRevealAt: (value) => events.push(["revealAt", value]),
        // Record set loading calls for assertions.
        setLoading: (value) => events.push(["loading", value]),
        // Record log error calls for assertions.
        logError: (error) => events.push(["log", error]),
        ...overrides,
    };
    return { deps, events, rushee, questions };
}

test("PIS initial load hydrates identity and rushee before requesting questions", async () => {
    // Verify PIS initial load hydrates identity and rushee before requesting questions.
    const { deps, events, rushee, questions } = harness();
    await loadPisPageData(deps);

    assert.deepEqual(events, [
        ["verify"],
        ["storedUser"],
        ["currentUser", { id: "brother-1", firstName: "Ada", lastName: "Lovelace" }],
        ["get", "/api/rushee/900000001"],
        ["rushee", rushee],
        ["answers", {}],
        ["get", "/api/rushee/get-pis-questions/900000001"],
        ["questions", questions],
        ["available", true],
        ["revealAt", null],
        ["loading", false],
    ]);
});

test("a false verification result navigates but retains the existing data-load sequence", async () => {
    // Verify a false verification result navigates but retains the existing data-load sequence.
    const { deps, events } = harness({
        // Record verification and deny access.
        verifyUser: async () => {
            events.push(["verify"]);
            return false;
        },
    });
    await loadPisPageData(deps);

    assert.deepEqual(events.slice(0, 4), [
        ["verify"],
        ["navigate", "/error/Default Error Title/Default Error Description"],
        ["storedUser"],
        ["currentUser", { id: "brother-1", firstName: "Ada", lastName: "Lovelace" }],
    ]);
    assert.deepEqual(events.filter(/* Select recorded get calls. */ ([kind]) => kind === "get"), [
        ["get", "/api/rushee/900000001"],
        ["get", "/api/rushee/get-pis-questions/900000001"],
    ]);
    assert.deepEqual(events.at(-1), ["loading", false]);
});

test("an existing collaborator is retained and a failed questions response navigates", async () => {
    // Verify an existing collaborator is retained and a failed questions response navigates.
    const existing = { id: "already-joined" };
    const { deps, events } = harness({
        currentUser: existing,
        // Return a failed questions response while allowing rushee loading.
        get: async (url) => {
            events.push(["get", url]);
            return url.includes("get-pis-questions")
                ? { data: { status: "error" } }
                : { data: { status: "success", payload: { pis: [] } } };
        },
    });
    await loadPisPageData(deps);

    assert.equal(events.some(
        /* Select recorded storedUser or currentUser calls. */
        ([kind]) => kind === "storedUser" || kind === "currentUser"), false);
    assert.deepEqual(events.slice(-2), [
        ["navigate", "/error/Default Error Title/Failed to fetch PIS questions"],
        ["loading", false],
    ]);
});

test("verification and data errors navigate and clear loading without later requests", async () => {
    // Verify verification and data errors navigate and clear loading without later requests.
    const failure = new Error("offline");
    const verification = harness({ verifyUser: async () => {
        // Simulate a dependency failure for this scenario.
         throw failure; } });
    const data = harness();
    data.deps.get = async (url) => {
        // Record the request and throw the configured load failure.
        data.events.push(["get", url]);
        throw failure;
    };

    for (const failing of [verification, data]) {
        await loadPisPageData(failing.deps);
        assert.deepEqual(failing.events.slice(-3), [
            ["log", failure],
            ["navigate", "/error/Default Error Title/Default Error Description"],
            ["loading", false],
        ]);
        assert.equal(failing.events.some(
            /* Select recorded get calls. */
            ([kind, url]) => kind === "get" && url.includes("get-pis-questions")), false);
    }
});
