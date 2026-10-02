import assert from "node:assert/strict";
import test from "node:test";

import { loadRusheeZoom } from "../../../src/features/rushee/zoom/loadRusheeZoom.js";

function setup({ verified = true, user = { email: "member@example.com" }, claims = { admin: true, bidcom: false }, rusheeResponse = { status: "success", payload: { gtid: "123" } }, visibilityResponse = { status: "success", require_comment_to_view: false }, tokenError } = {}) {
    const calls = [];
    const options = {
        verifyUser: async () => {
            calls.push(["verify"]);
            if (verified instanceof Error) throw verified;
            return verified;
        },
        navigate: (path) => calls.push(["navigate", path]),
        errorTitle: "Uh Oh! Something untoward happened",
        errorDescription: "Something really weird happened",
        auth: { currentUser: user && {
            ...user,
            getIdTokenResult: async (forceRefresh) => {
                calls.push(["token", forceRefresh]);
                if (tokenError) throw tokenError;
                return { claims };
            },
        } },
        setIsAdmin: (value) => calls.push(["admin", value]),
        setIsBidcom: (value) => calls.push(["bidcom", value]),
        axios: {
            get: async (path) => {
                calls.push(["get", path]);
                const response = path.endsWith("/123") ? rusheeResponse : visibilityResponse;
                if (response instanceof Error) throw response;
                return { data: response };
            },
        },
        api: "/api",
        gtid: "123",
        setRushee: (value) => calls.push(["rushee", value]),
        setRequireCommentToView: (value) => calls.push(["visibility", value]),
        setError: (value) => calls.push(["error", value]),
        setLoading: (value) => calls.push(["loading", value]),
        logError: (message, error) => calls.push(["logError", message, error.message]),
        logData: (value) => calls.push(["logData", value]),
    };
    return { calls, options };
}

test("zoom load keeps verification, role checks, rushee fetch, and visibility order", async () => {
    const { calls, options } = setup();
    await loadRusheeZoom(options);
    assert.deepEqual(calls, [
        ["verify"], ["token", true], ["admin", true], ["bidcom", false],
        ["get", "/api/rushee/123"], ["logData", { gtid: "123" }], ["rushee", { gtid: "123" }],
        ["get", "/api/brother/comment-visibility/status"], ["visibility", false], ["loading", false],
    ]);
});

test("verification redirect and missing rushee retain their later reads", async () => {
    const invalid = setup({ verified: false });
    await loadRusheeZoom(invalid.options);
    assert.deepEqual(invalid.calls[1], ["navigate", "/error/Uh Oh! Something untoward happened/Something really weird happened"]);
    assert.ok(invalid.calls.some(([kind, path]) => kind === "get" && path === "/api/rushee/123"));

    const absent = setup({ rusheeResponse: { status: "error" } });
    await loadRusheeZoom(absent.options);
    assert.ok(absent.calls.some(([kind, path]) => kind === "navigate" && path.endsWith("Rushee with this GTID does not exist")));
    assert.ok(absent.calls.some(([kind, path]) => kind === "get" && path === "/api/brother/comment-visibility/status"));
    assert.deepEqual(absent.calls.at(-1), ["loading", false]);
});

test("claim and visibility failures log and preserve later loading", async () => {
    const failed = setup({ tokenError: new Error("claims offline"), visibilityResponse: new Error("visibility offline") });
    await loadRusheeZoom(failed.options);
    assert.deepEqual(failed.calls.find(([kind]) => kind === "logError"), ["logError", "Error checking admin/bidcom status:", "claims offline"]);
    assert.ok(failed.calls.some(([kind, path]) => kind === "get" && path === "/api/rushee/123"));
    assert.ok(!failed.calls.some(([kind]) => kind === "visibility"));
    assert.deepEqual(failed.calls.at(-1), ["loading", false]);
});

test("rushee request rejection marks the error and stops visibility fetch", async () => {
    const failed = setup({ rusheeResponse: new Error("network") });
    await loadRusheeZoom(failed.options);
    assert.ok(failed.calls.some(([kind, value]) => kind === "error" && value === true));
    assert.ok(!failed.calls.some(([kind, path]) => kind === "get" && path === "/api/brother/comment-visibility/status"));
    assert.deepEqual(failed.calls.at(-1), ["loading", false]);
});
