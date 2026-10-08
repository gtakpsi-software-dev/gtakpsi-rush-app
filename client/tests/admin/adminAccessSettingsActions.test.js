import assert from "node:assert/strict";
import test from "node:test";

import { createAccessSettingsActions } from "../../src/features/admin/access/accessSettingsActions.js";

// Create isolated state, dependency fakes, and captured calls for this test.
function setup(response = { status: "success" }, overrides = {}) {
    const calls = [];
    const axios = {
        // Record the POST request and return or throw the configured response.
        post: async (url, body) => {
            calls.push(["post", url, body]);
            if (response instanceof Error) throw response;
            return { data: response };
        },
    };
    const toast = {
        // Record success calls for assertions.
        success: (message, options) => calls.push(["success", message, options]),
        // Record error calls for assertions.
        error: (message, options) => calls.push(["error", message, options]),
    };
    const actions = createAccessSettingsActions({
        apiBase: "/api/admin",
        rushAppStatus: { disable_bidcom: false, disable_regular: true, midterm_mode: true },
        // Record set rush app status calls for assertions.
        setRushAppStatus: (value) => calls.push(["rushStatus", value]),
        // Record set rush app loading calls for assertions.
        setRushAppLoading: (value) => calls.push(["rushLoading", value]),
        // Record set midterm loading calls for assertions.
        setMidtermLoading: (value) => calls.push(["midtermLoading", value]),
        // Record set comment visibility status calls for assertions.
        setCommentVisibilityStatus: (value) => calls.push(["commentsStatus", value]),
        // Record set comment visibility loading calls for assertions.
        setCommentVisibilityLoading: (value) => calls.push(["commentsLoading", value]),
        axios,
        toast,
        auth: { currentUser: { email: "admin@example.com" } },
        ...overrides,
    });
    return { calls, actions };
}

test("group access toggle preserves the other settings and request order", async () => {
    // Verify group access toggle preserves the other settings and request order.
    const { calls, actions } = setup();
    await actions.handleToggleRushAppAccess("disable_bidcom", true);

    assert.deepEqual(calls[0], ["rushLoading", true]);
    assert.deepEqual(calls[1], ["post", "/api/admin/rush-app/update", {
        disable_bidcom: true, disable_regular: true, midterm_mode: true,
    }]);
    assert.deepEqual(calls[2], ["rushStatus", {
        disable_bidcom: true, disable_regular: true, midterm_mode: true,
        updated_by: "admin@example.com",
    }]);
    assert.equal(calls[3][1], "Bid Committee access disabled");
    assert.deepEqual(calls[3][2], { position: "top-center", autoClose: 2000, theme: "dark" });
    assert.deepEqual(calls[4], ["rushLoading", false]);
});

test("regular-access and midterm toggles retain boolean coercion and status fields", async () => {
    // Verify regular-access and midterm toggles retain boolean coercion and status fields.
    const regular = setup();
    await regular.actions.handleToggleRushAppAccess("disable_regular", false);
    assert.deepEqual(regular.calls[1], ["post", "/api/admin/rush-app/update", {
        disable_bidcom: false, disable_regular: false, midterm_mode: true,
    }]);
    assert.equal(regular.calls[3][1], "Regular Brothers access enabled");

    const midterm = setup();
    await midterm.actions.handleToggleMidtermMode(false);
    assert.deepEqual(midterm.calls[0], ["midtermLoading", true]);
    assert.deepEqual(midterm.calls[1], ["post", "/api/admin/rush-app/update", {
        disable_bidcom: false, disable_regular: true, midterm_mode: false,
    }]);
    assert.equal(midterm.calls[3][1], "Midterm Mode disabled");
    assert.deepEqual(midterm.calls.at(-1), ["midtermLoading", false]);
});

test("comment visibility toggle keeps the stored field and actor fallback", async () => {
    // Verify comment visibility toggle keeps the stored field and actor fallback.
    const { calls, actions } = setup(undefined, { auth: { currentUser: null } });
    await actions.handleToggleCommentVisibility(false);

    assert.deepEqual(calls[0], ["commentsLoading", true]);
    assert.deepEqual(calls[1], ["post", "/api/admin/comment-visibility/update", {
        require_comment_to_view: false,
    }]);
    assert.deepEqual(calls[2], ["commentsStatus", {
        require_comment_to_view: false, updated_by: "admin",
    }]);
    assert.equal(calls[3][1], "Comment viewing open — all brothers can read every comment");
    assert.deepEqual(calls.at(-1), ["commentsLoading", false]);
});

test("failed responses and transport errors retain messages and clear loading", async () => {
    // Verify failed responses and transport errors retain messages and clear loading.
    const denied = setup({ status: "error", message: "Denied" });
    await denied.actions.handleToggleRushAppAccess("disable_regular", true);
    assert.equal(denied.calls[2][1], "Denied");
    assert.deepEqual(denied.calls.at(-1), ["rushLoading", false]);
    assert.ok(!denied.calls.some(/* Select recorded rushStatus calls. */ ([kind]) => kind === "rushStatus"));

    const offline = setup(new Error("offline"));
    await offline.actions.handleToggleMidtermMode(true);
    assert.equal(offline.calls[2][1], "Failed to update Midterm Mode");
    assert.deepEqual(offline.calls.at(-1), ["midtermLoading", false]);

    const comments = setup({ status: "error" });
    await comments.actions.handleToggleCommentVisibility(true);
    assert.equal(comments.calls[2][1], "Failed to update settings");
    assert.deepEqual(comments.calls.at(-1), ["commentsLoading", false]);
});

test("state setter failures show the existing request error and clear loading", async () => {
    // Verify state setter failures show the existing request error and clear loading.
    const calls = [];
    const { actions } = setup(undefined, {
        // Record the status update and simulate a failing state setter.
        setRushAppStatus: (value) => {
            calls.push(["rushStatus", value]);
            throw new Error("state setter failed");
        },
        // Record set rush app loading calls for assertions.
        setRushAppLoading: (value) => calls.push(["rushLoading", value]),
        toast: {
            // Record success calls for assertions.
            success: (message) => calls.push(["success", message]),
            // Record error calls for assertions.
            error: (message) => calls.push(["error", message]),
        },
    });

    await actions.handleToggleRushAppAccess("disable_bidcom", true);

    assert.deepEqual(calls.map(/* Return kind to the caller. */ ([kind]) => kind), ["rushLoading", "rushStatus", "error", "rushLoading"]);
    assert.deepEqual(calls[2], ["error", "Failed to update Rush App settings"]);
    assert.deepEqual(calls.at(-1), ["rushLoading", false]);
});
