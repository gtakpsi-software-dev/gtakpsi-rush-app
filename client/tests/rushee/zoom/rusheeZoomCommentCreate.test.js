import assert from "node:assert/strict";
import test from "node:test";

import { createCommentCreateActions } from "../../../src/features/rushee/zoom/commentCreateActions.js";

const rushee = { first_name: "Ada", last_name: "Example" };
const user = { firstname: "Sam", lastname: "Member" };
const ratingFields = ["Why AKPsi", "Group Interactions"];
const toastOptions = {
    position: "top-center", autoClose: 5000, hideProgressBar: false,
    closeOnClick: true, pauseOnHover: true, draggable: true,
    progress: undefined, theme: "dark",
};

// Create isolated state, dependency fakes, and captured calls for this test.
function setup({ currentRushee = rushee, newComment = "Good meeting", ratings = { "Why AKPsi": 4, "Group Interactions": 2 }, ratingNotSeen = { "Why AKPsi": false, "Group Interactions": true }, response = { status: "success" } } = {}) {
    const calls = [];
    const actions = createCommentCreateActions({
        rushee: currentRushee,
        user,
        gtid: "123",
        api: "/api",
        // Record navigate calls for assertions.
        navigate: (path) => calls.push(["navigate", path]),
        ratings,
        ratingNotSeen,
        newComment,
        ratingFields,
        // Record set is adding comment calls for assertions.
        setIsAddingComment: (value) => calls.push(["adding", value]),
        // Record set comment warnings calls for assertions.
        setCommentWarnings: (value) => calls.push(["warnings", value]),
        // Record set ratings calls for assertions.
        setRatings: (value) => calls.push(["ratings", value]),
        // Record set rating not seen calls for assertions.
        setRatingNotSeen: (value) => calls.push(["notSeen", value]),
        // Record set loading calls for assertions.
        setLoading: (value) => calls.push(["loading", value]),
        // Record set new comment calls for assertions.
        setNewComment: (value) => calls.push(["comment", value]),
        // Return the create default ratings fixture for this scenario.
        createDefaultRatings: () => ({ "Why AKPsi": 3, "Group Interactions": 3 }),
        // Return the create default not seen fixture for this scenario.
        createDefaultNotSeen: () => ({ "Why AKPsi": true, "Group Interactions": true }),
        // Record validation inputs and flag text containing the test warning word.
        validateComment: (text, first, last) => {
            calls.push(["validate", text, first, last]);
            return { hasWarnings: text.includes("bad") };
        },
        // Return the generate warnings fixture for this scenario.
        generateWarnings: () => ["Warning"],
        toast: {
            // Record warning calls for assertions.
            warning: (message, options) => calls.push(["warningToast", message, options]),
            // Record error calls for assertions.
            error: (message, options) => calls.push(["errorToast", message, options]),
        },
        axios: {
            // Record comment creation and return or throw the configured response.
            post: async (url, payload) => {
                calls.push(["post", url, payload]);
                if (response instanceof Error) throw response;
                return { data: response };
            },
        },
        // Record reload calls for assertions.
        reload: () => calls.push(["reload"]),
        // Record log calls for assertions.
        log: (value) => calls.push(["log", value]),
    });
    return { calls, actions };
}

test("comment setup, ratings, and live warnings retain state behavior", () => {
    // Verify comment setup, ratings, and live warnings retain state behavior.
    const { calls, actions } = setup();
    actions.handleAddComment();
    assert.deepEqual(calls, [
        ["adding", true], ["warnings", []],
        ["ratings", { "Why AKPsi": 3, "Group Interactions": 3 }],
        ["notSeen", { "Why AKPsi": true, "Group Interactions": true }],
    ]);
    actions.handleRatingChange("Why AKPsi", 5);
    assert.deepEqual(calls.at(-1), ["ratings", { "Why AKPsi": 5, "Group Interactions": 2 }]);
    actions.handleRatingNotSeenChange("Group Interactions", false);
    assert.deepEqual(calls.at(-1), ["notSeen", { "Why AKPsi": false, "Group Interactions": false }]);
    actions.validateNewComment("bad wording");
    assert.deepEqual(calls.at(-1), ["warnings", ["Warning"]]);

    const absent = setup({ currentRushee: null });
    absent.actions.validateNewComment("bad wording");
    assert.deepEqual(absent.calls, []);
});

test("warnings still allow submission and only seen ratings enter the payload", async () => {
    // Verify warnings still allow submission and only seen ratings enter the payload.
    const { calls, actions } = setup({ newComment: "bad wording" });
    await actions.handleSubmitComment();

    assert.deepEqual(calls[0], ["validate", "bad wording", "Ada", "Example"]);
    assert.deepEqual(calls[1], ["warnings", ["Warning"]]);
    assert.match(calls[2][1], /potentially problematic language/);
    assert.deepEqual(calls[2][2], toastOptions);
    assert.deepEqual(calls[4], ["log", user]);
    assert.deepEqual(calls[5], ["post", "/api/rushee/post-comment/123", {
        brother_id: "000000", brother_name: "Sam Member", comment: "bad wording",
        ratings: [{ name: "Why AKPsi", value: 4 }],
    }]);
    assert.deepEqual(calls.map(/* Return kind to the caller. */ ([kind]) => kind).slice(5), [
        "post", "reload", "comment", "warnings", "ratings", "notSeen", "adding", "loading",
    ]);
    assert.deepEqual(calls.at(-1), ["loading", false]);
});

test("server errors and network errors keep their distinct outcomes and reset the form", async () => {
    // Verify server errors and network errors keep their distinct outcomes and reset the form.
    const rejected = setup({ response: { status: "error", message: "Denied" } });
    await rejected.actions.handleSubmitComment();
    assert.equal(rejected.calls.find(/* Select recorded errorToast calls. */ ([kind]) => kind === "errorToast")[1], "Denied");
    assert.deepEqual(rejected.calls.find(/* Select recorded errorToast calls. */ ([kind]) => kind === "errorToast")[2], toastOptions);
    assert.ok(!rejected.calls.some(/* Select recorded reload or navigate calls. */ ([kind]) => kind === "reload" || kind === "navigate"));
    assert.deepEqual(rejected.calls.at(-1), ["loading", false]);

    const offline = setup({ response: new Error("offline") });
    await offline.actions.handleSubmitComment();
    assert.ok(offline.calls.some(/* Select recorded log calls. */ ([kind]) => kind === "log"));
    assert.ok(offline.calls.some(/* Select recorded navigate calls. */ ([kind, path]) => kind === "navigate" && path.includes("network error")));
    assert.deepEqual(offline.calls.at(-1), ["loading", false]);
});

test("missing rushee returns before validation or loading", async () => {
    // Verify missing rushee returns before validation or loading.
    const { calls, actions } = setup({ currentRushee: null });
    await actions.handleSubmitComment();
    assert.deepEqual(calls, []);
});
