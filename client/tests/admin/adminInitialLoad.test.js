import assert from "node:assert/strict";
import test from "node:test";

import { loadAdminData } from "../../src/features/admin/bootstrap/loadAdminData.js";

function setup({ currentUser = { email: "admin@example.com" }, admin = true, allowlist = [], verified = true, failedPath, rejectedPath, failingSetter } = {}) {
    const calls = [];
    const timeSlots = [
        { time: { $date: { $numberLong: "200" } } },
        { time: { $date: { $numberLong: "100" } } },
    ];
    const responses = {
        "/api/rushee/get-rushees": { status: "success", payload: ["rushee"] },
        "/api/rushee/get-available-timeslots": { status: "success", payload: ["available"] },
        "/api/admin/pis-availability/status": { status: "success", is_active: true, sent_at: "today" },
        "/api/admin/pis-availability/all": { status: "success", payload: ["brother"] },
        "/api/admin/get_pis_timeslots": { status: "success", payload: timeSlots },
        "/api/admin/rush-app/status": { status: "success", disable_bidcom: true, disable_regular: false, updated_by: "Ada" },
        "/api/admin/comment-visibility/status": { status: "success", require_comment_to_view: false, updated_by: "Ada" },
    };
    const auth = { currentUser: currentUser && {
        ...currentUser,
        getIdTokenResult: async (forceRefresh) => {
            calls.push(["token", forceRefresh]);
            return { claims: { admin }, token: "token-123" };
        },
    } };
    const axios = {
        defaults: { headers: { common: {} } },
        get: async (path) => {
            calls.push(["get", path, axios.defaults.headers.common.Authorization]);
            if (path === failedPath) throw new Error("offline");
            if (path === rejectedPath) return { data: { status: "error" } };
            return { data: responses[path] };
        },
    };
    const options = {
        verifyUser: async () => {
            calls.push(["verify"]);
            return verified;
        },
        navigate: (path) => calls.push(["navigate", path]),
        errorTitle: "Invalid User Credentials",
        errorDescription: "If this is a mistake, try logging back in",
        auth,
        allowlist,
        axios,
        db: { name: "firestore" },
        collection: (db, name) => {
            calls.push(["collection", db.name, name]);
            return { name };
        },
        getDocs: async (collection) => {
            calls.push(["getDocs", collection.name]);
            return { docs: [{ id: "doc-1", data: () => ({ email: "brother@example.com" }) }] };
        },
        apiBase: "/api/admin",
        rusheeApiBase: "/api/rushee",
        toast: { error: (message) => calls.push(["toast", message]) },
        logError: (message, error) => calls.push(["log", message, error.message]),
        setBrothers: (value) => calls.push(["brothers", value]),
        setRushees: (value) => {
            calls.push(["rushees", value]);
            if (failingSetter === "rushees") throw new Error("setter failed");
        },
        setAvailableTimeslots: (value) => calls.push(["available", value]),
        setPisFormStatus: (value) => calls.push(["formStatus", value]),
        setBrotherAvailabilities: (value) => calls.push(["availabilities", value]),
        setAllPisTimeslots: (value) => calls.push(["pisTimeslots", value]),
        setRushAppStatus: (value) => calls.push(["rushStatus", value]),
        setCommentVisibilityStatus: (value) => calls.push(["commentStatus", value]),
        setLoading: (value) => calls.push(["loading", value]),
    };
    return { calls, options, axios, timeSlots };
}

test("authorized load preserves authentication, fetch order, and stored state shapes", async () => {
    const { calls, options, axios, timeSlots } = setup();
    await loadAdminData(options);

    assert.deepEqual(calls.slice(0, 4), [
        ["verify"], ["token", true], ["collection", "firestore", "brothers"], ["getDocs", "brothers"],
    ]);
    assert.deepEqual(calls.filter(([kind]) => kind === "get").map(([, path]) => path), [
        "/api/rushee/get-rushees", "/api/rushee/get-available-timeslots",
        "/api/admin/pis-availability/status", "/api/admin/pis-availability/all",
        "/api/admin/get_pis_timeslots", "/api/admin/rush-app/status",
        "/api/admin/comment-visibility/status",
    ]);
    assert.ok(calls.filter(([kind]) => kind === "get").every(([, , token]) => token === "Bearer token-123"));
    assert.equal(axios.defaults.headers.common.Authorization, "Bearer token-123");
    assert.deepEqual(calls.find(([kind]) => kind === "brothers")[1], [{ id: "doc-1", email: "brother@example.com" }]);
    assert.deepEqual(calls.find(([kind]) => kind === "formStatus")[1], { is_active: true, sent_at: "today" });
    assert.deepEqual(calls.find(([kind]) => kind === "rushStatus")[1], {
        disable_bidcom: true, disable_regular: false, midterm_mode: false, updated_by: "Ada",
    });
    assert.deepEqual(calls.find(([kind]) => kind === "pisTimeslots")[1], timeSlots);
    assert.deepEqual(timeSlots.map((slot) => slot.time.$date.$numberLong), ["100", "200"]);
    assert.deepEqual(calls.at(-1), ["loading", false]);
});

test("missing or unauthorized users stop before data reads", async () => {
    const missing = setup({ currentUser: null });
    await loadAdminData(missing.options);
    assert.deepEqual(missing.calls.map(([kind]) => kind), ["verify", "navigate"]);

    const denied = setup({ admin: false });
    await loadAdminData(denied.options);
    assert.deepEqual(denied.calls.map(([kind]) => kind), ["verify", "token", "toast", "navigate"]);
    assert.equal(denied.calls[2][1], "Not authorized");
    assert.ok(!denied.calls.some(([kind]) => kind === "loading"));

    const allowlisted = setup({ admin: false, allowlist: ["admin@example.com"] });
    await loadAdminData(allowlisted.options);
    assert.ok(allowlisted.calls.some(([kind]) => kind === "get"));
    assert.deepEqual(allowlisted.calls.at(-1), ["loading", false]);
});

test("failed verification still follows the existing navigation and load sequence", async () => {
    const { calls, options } = setup({ verified: false });
    await loadAdminData(options);
    assert.deepEqual(calls[0], ["verify"]);
    assert.deepEqual(calls[1], ["navigate", "/error/Invalid User Credentials/If this is a mistake, try logging back in"]);
    assert.deepEqual(calls[2], ["token", true]);
    assert.deepEqual(calls.at(-1), ["loading", false]);
});

test("an individual data failure logs and continues later fetches", async () => {
    const { calls, options } = setup({ failedPath: "/api/admin/pis-availability/all" });
    await loadAdminData(options);
    assert.deepEqual(calls.find(([kind]) => kind === "log"), ["log", "Failed to fetch brother availabilities:", "offline"]);
    assert.ok(calls.some(([kind, path]) => kind === "get" && path === "/api/admin/comment-visibility/status"));
    assert.deepEqual(calls.at(-1), ["loading", false]);
});

test("unsuccessful data responses skip only their setter without logging", async () => {
    const { calls, options } = setup({ rejectedPath: "/api/rushee/get-rushees" });
    await loadAdminData(options);

    assert.ok(!calls.some(([kind]) => kind === "rushees" || kind === "log"));
    assert.ok(calls.some(([kind]) => kind === "available"));
    assert.deepEqual(calls.at(-1), ["loading", false]);
});

test("a setter error uses its section label and does not stop later reads", async () => {
    const { calls, options } = setup({ failingSetter: "rushees" });
    await loadAdminData(options);

    assert.deepEqual(calls.find(([kind]) => kind === "log"), [
        "log", "Failed to fetch rushees:", "setter failed",
    ]);
    assert.ok(calls.some(([kind]) => kind === "commentStatus"));
    assert.deepEqual(calls.at(-1), ["loading", false]);
});
