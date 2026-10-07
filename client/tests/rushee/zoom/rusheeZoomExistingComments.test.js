import assert from "node:assert/strict";
import test from "node:test";

import { createExistingCommentActions } from "../../../src/features/rushee/zoom/existingCommentActions.js";

const rushee = { first_name: "Ada", last_name: "Example" };
const comment = {
    brother_name: "Sam Member",
    comment: "Original comment",
    ratings: [{ name: "Why AKPsi", value: 4 }],
    night: { name: "Night 1" },
};
const toastOptions = {
    position: "top-center", autoClose: 5000, hideProgressBar: false,
    closeOnClick: true, pauseOnHover: true, draggable: true,
    progress: undefined, theme: "dark",
};

function setup({ currentRushee = rushee, currentError = false, editedCommentText = "Edited comment", editResponse = { status: "success" }, deleteResponse = { status: "success" } } = {}) {
    const calls = [];
    const actions = createExistingCommentActions({
        rushee: currentRushee,
        error: currentError,
        editedCommentText,
        gtid: "123",
        api: "/api",
        setEditingCommentId: (value) => calls.push(["editId", value]),
        setEditedCommentText: (value) => calls.push(["editText", value]),
        setEditCommentWarnings: (value) => calls.push(["warnings", value]),
        setLoading: (value) => calls.push(["loading", value]),
        validateComment: (text, first, last) => {
            calls.push(["validate", text, first, last]);
            return { hasWarnings: text.includes("bad") };
        },
        generateWarnings: () => ["Warning"],
        toast: {
            warning: (message, options) => calls.push(["warningToast", message, options]),
            error: (message, options) => calls.push(["errorToast", message, options]),
        },
        axios: {
            post: async (url, payload) => {
                calls.push(["post", url, payload]);
                const response = url.includes("edit-comment") ? editResponse : deleteResponse;
                if (response instanceof Error) throw response;
                return { data: response };
            },
        },
        reload: () => calls.push(["reload"]),
        log: (value) => calls.push(["log", value]),
    });
    return { calls, actions };
}

test("opening and validating an edit keep the original comment-text identity", () => {
    const { calls, actions } = setup();
    actions.handleEditComment(comment);
    assert.deepEqual(calls, [
        ["editId", "Original comment"], ["editText", "Original comment"], ["warnings", []],
    ]);
    actions.validateEditComment("bad wording");
    assert.deepEqual(calls.at(-1), ["warnings", ["Warning"]]);

    const absent = setup({ currentRushee: null });
    absent.actions.validateEditComment("bad wording");
    assert.deepEqual(absent.calls, []);
});

test("edited comments warn but submit the original ratings and night", async () => {
    const { calls, actions } = setup({ editedCommentText: "bad wording" });
    await actions.handleSubmitEdit(comment);
    assert.deepEqual(calls[0], ["log", comment]);
    assert.deepEqual(calls[1], ["validate", "bad wording", "Ada", "Example"]);
    assert.deepEqual(calls[2], ["warnings", ["Warning"]]);
    assert.match(calls[3][1], /Edited comment contains potentially problematic language/);
    assert.deepEqual(calls[3][2], toastOptions);
    assert.deepEqual(calls[5], ["post", "/api/rushee/edit-comment/123", {
        brother_id: "000000",
        brother_name: "Sam Member",
        comment: "bad wording",
        ratings: comment.ratings,
        night: comment.night,
    }]);
    assert.deepEqual(calls.slice(6).map(([kind]) => kind), ["reload", "editId", "editText", "warnings", "loading"]);
    assert.deepEqual(calls.at(-1), ["loading", false]);
});

test("edit response and network errors retain their distinct logs and reset state", async () => {
    const denied = setup({ editResponse: { status: "error", message: "Denied" } });
    await denied.actions.handleSubmitEdit(comment);
    assert.equal(denied.calls.find(([kind]) => kind === "errorToast")[1], "Denied");
    assert.deepEqual(denied.calls.find(([kind]) => kind === "errorToast")[2], toastOptions);
    assert.deepEqual(denied.calls.at(-1), ["loading", false]);

    const offline = setup({ currentError: true, editResponse: new Error("offline") });
    await offline.actions.handleSubmitEdit(comment);
    assert.deepEqual(offline.calls.find(([kind, value]) => kind === "log" && value === true), ["log", true]);
    assert.equal(offline.calls.find(([kind]) => kind === "errorToast")[1], "Some network error occurred");
    assert.deepEqual(offline.calls.find(([kind]) => kind === "errorToast")[2], toastOptions);
    assert.deepEqual(offline.calls.at(-1), ["loading", false]);
});

test("deleting passes the stored comment through and retains success and error cleanup", async () => {
    const removed = setup();
    await removed.actions.handleDeleteComment(comment);
    assert.deepEqual(removed.calls, [
        ["loading", true], ["post", "/api/rushee/delete-comment/123", comment],
        ["reload"], ["loading", false],
    ]);

    const denied = setup({ deleteResponse: { status: "error", message: "Denied" } });
    await denied.actions.handleDeleteComment(comment);
    assert.equal(denied.calls[2][1], "Denied");
    assert.deepEqual(denied.calls[2][2], toastOptions);
    assert.deepEqual(denied.calls.at(-1), ["loading", false]);

    const offline = setup({ deleteResponse: new Error("offline") });
    await offline.actions.handleDeleteComment(comment);
    assert.deepEqual(offline.calls.map(([kind]) => kind), ["loading", "post", "log", "errorToast", "loading"]);
    assert.equal(offline.calls[3][1], "Some network error occurred");
    assert.deepEqual(offline.calls[3][2], toastOptions);
});
