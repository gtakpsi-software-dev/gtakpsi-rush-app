import assert from "node:assert/strict";
import test from "node:test";

import { loadRusheeZoom } from "../../../src/features/rushee/zoom/loadRusheeZoom.js";

// Create isolated state, dependency fakes, and captured calls for this test.
function setup({ verified = true, user = { email: "member@example.com" }, claims = { admin: true, bidcom: false }, rusheeResponse = { status: "success", payload: { gtid: "123" } }, visibilityResponse = { status: "success", require_comment_to_view: false }, tokenError } = {}) {
    const calls = [];
    const options = {
        // Record verification and return or throw its configured result.
        verifyUser: async () => {
            calls.push(["verify"]);
            if (verified instanceof Error) throw verified;
            return verified;
        },
        // Record navigate calls for assertions.
        navigate: (path) => calls.push(["navigate", path]),
        errorTitle: "Uh Oh! Something untoward happened",
        errorDescription: "Something really weird happened",
        auth: { currentUser: user && {
            ...user,
            // Record token refresh and return claims or the configured error.
            getIdTokenResult: async (forceRefresh) => {
                calls.push(["token", forceRefresh]);
                if (tokenError) throw tokenError;
                return { claims };
            },
        } },
        // Record set is admin calls for assertions.
        setIsAdmin: (value) => calls.push(["admin", value]),
        // Record set is bidcom calls for assertions.
        setIsBidcom: (value) => calls.push(["bidcom", value]),
        axios: {
            // Select rushee or visibility data for the recorded request.
            get: async (path) => {
                calls.push(["get", path]);
                const response = path.endsWith("/123") ? rusheeResponse : visibilityResponse;
                if (response instanceof Error) throw response;
                return { data: response };
            },
        },
        api: "/api",
        gtid: "123",
        // Record set rushee calls for assertions.
        setRushee: (value) => calls.push(["rushee", value]),
        // Record set require comment to view calls for assertions.
        setRequireCommentToView: (value) => calls.push(["visibility", value]),
        // Record set error calls for assertions.
        setError: (value) => calls.push(["error", value]),
        // Record set loading calls for assertions.
        setLoading: (value) => calls.push(["loading", value]),
        // Record log error calls for assertions.
        logError: (message, error) => calls.push(["logError", message, error.message]),
        // Record log data calls for assertions.
        logData: (value) => calls.push(["logData", value]),
    };
    return { calls, options };
}

test("zoom load keeps verification, role checks, rushee fetch, and visibility order", async () => {
    // Verify zoom load keeps verification, role checks, rushee fetch, and visibility order.
    const { calls, options } = setup();
    await loadRusheeZoom(options);
    assert.deepEqual(calls, [
        ["verify"], ["token", true], ["admin", true], ["bidcom", false],
        ["get", "/api/rushee/123"], ["logData", { gtid: "123" }], ["rushee", { gtid: "123" }],
        ["get", "/api/brother/comment-visibility/status"], ["visibility", false], ["loading", false],
    ]);
});

test("verification redirect and missing rushee retain their later reads", async () => {
    // Verify verification redirect and missing rushee retain their later reads.
    const invalid = setup({ verified: false });
    await loadRusheeZoom(invalid.options);
    assert.deepEqual(invalid.calls[1], ["navigate", "/error/Uh Oh! Something untoward happened/Something really weird happened"]);
    assert.ok(invalid.calls.some(/* Select recorded get calls. */ ([kind, path]) => kind === "get" && path === "/api/rushee/123"));

    const absent = setup({ rusheeResponse: { status: "error" } });
    await loadRusheeZoom(absent.options);
    assert.ok(absent.calls.some(
        /* Select recorded navigate calls. */
        ([kind, path]) => kind === "navigate" && path.endsWith("Rushee with this GTID does not exist")));
    assert.ok(absent.calls.some(
        /* Select recorded get calls. */
        ([kind, path]) => kind === "get" && path === "/api/brother/comment-visibility/status"));
    assert.deepEqual(absent.calls.at(-1), ["loading", false]);
});

test("claim and visibility failures log and preserve later loading", async () => {
    // Verify claim and visibility failures log and preserve later loading.
    const failed = setup({ tokenError: new Error("claims offline"), visibilityResponse: new Error("visibility offline") });
    await loadRusheeZoom(failed.options);
    assert.deepEqual(failed.calls.find(
        /* Select recorded logError calls. */
        ([kind]) => kind === "logError"), ["logError", "Error checking admin/bidcom status:", "claims offline"]);
    assert.ok(failed.calls.some(/* Select recorded get calls. */ ([kind, path]) => kind === "get" && path === "/api/rushee/123"));
    assert.ok(!failed.calls.some(/* Select recorded visibility calls. */ ([kind]) => kind === "visibility"));
    assert.deepEqual(failed.calls.at(-1), ["loading", false]);
});

test("rushee request rejection marks the error and stops visibility fetch", async () => {
    // Verify rushee request rejection marks the error and stops visibility fetch.
    const failed = setup({ rusheeResponse: new Error("network") });
    await loadRusheeZoom(failed.options);
    assert.ok(failed.calls.some(/* Select recorded error calls. */ ([kind, value]) => kind === "error" && value === true));
    assert.ok(!failed.calls.some(
        /* Select recorded get calls. */
        ([kind, path]) => kind === "get" && path === "/api/brother/comment-visibility/status"));
    assert.deepEqual(failed.calls.at(-1), ["loading", false]);
});
