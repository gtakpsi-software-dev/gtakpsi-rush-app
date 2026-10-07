import assert from "node:assert/strict";
import test from "node:test";

import { loadPisPageData } from "../../src/features/pis/loadPisPageData.js";

function harness(overrides = {}) {
    const events = [];
    const rushee = { gtid: "900000001", pis: [] };
    const questions = [{ question: "Why?" }];
    const deps = {
        verifyUser: async () => {
            events.push(["verify"]);
            return true;
        },
        navigate: (path) => events.push(["navigate", path]),
        errorTitle: "Default Error Title",
        errorDescription: "Default Error Description",
        currentUser: null,
        auth: { currentUser: { uid: "brother-1", displayName: "Ada Lovelace" } },
        getStoredUser: () => {
            events.push(["storedUser"]);
            return null;
        },
        setCurrentUser: (user) => events.push(["currentUser", user]),
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
        setRushee: (value) => events.push(["rushee", value]),
        setAnswers: (updater) => events.push(["answers", updater({})]),
        setBrotherA: (value) => events.push(["brotherA", value]),
        setBrotherB: (value) => events.push(["brotherB", value]),
        setQuestions: (value) => events.push(["questions", value]),
        setQuestionsAvailable: (value) => events.push(["available", value]),
        setRevealAt: (value) => events.push(["revealAt", value]),
        setLoading: (value) => events.push(["loading", value]),
        logError: (error) => events.push(["log", error]),
        ...overrides,
    };
    return { deps, events, rushee, questions };
}

test("PIS initial load hydrates identity and rushee before requesting questions", async () => {
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
    const { deps, events } = harness({
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
    assert.deepEqual(events.filter(([kind]) => kind === "get"), [
        ["get", "/api/rushee/900000001"],
        ["get", "/api/rushee/get-pis-questions/900000001"],
    ]);
    assert.deepEqual(events.at(-1), ["loading", false]);
});

test("an existing collaborator is retained and a failed questions response navigates", async () => {
    const existing = { id: "already-joined" };
    const { deps, events } = harness({
        currentUser: existing,
        get: async (url) => {
            events.push(["get", url]);
            return url.includes("get-pis-questions")
                ? { data: { status: "error" } }
                : { data: { status: "success", payload: { pis: [] } } };
        },
    });
    await loadPisPageData(deps);

    assert.equal(events.some(([kind]) => kind === "storedUser" || kind === "currentUser"), false);
    assert.deepEqual(events.slice(-2), [
        ["navigate", "/error/Default Error Title/Failed to fetch PIS questions"],
        ["loading", false],
    ]);
});

test("verification and data errors navigate and clear loading without later requests", async () => {
    const failure = new Error("offline");
    const verification = harness({ verifyUser: async () => { throw failure; } });
    const data = harness();
    data.deps.get = async (url) => {
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
        assert.equal(failing.events.some(([kind, url]) => kind === "get" && url.includes("get-pis-questions")), false);
    }
});
