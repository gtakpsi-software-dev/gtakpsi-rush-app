import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { getVisibleComments, hasOwnComment, shouldShowAllComments } from "../../../src/features/comments/commentVisibility.js";
import { loadTsxComponent } from "../../helpers/loadTsxComponent.js";

const hookPath = fileURLToPath(new URL("../../../src/features/rushee/zoom/useRusheeZoomAccess.js", import.meta.url));

test("Rushee Zoom access stays restricted while loading and forwards the original fetch dependencies", async () => {
    // Verify Rushee Zoom access stays restricted while loading and forwards the original fetch dependencies.
    const effects = [];
    const requests = [];
    const auth = {};
    const axios = {};
    // Provide an inert verify user stub for this test.
    const verifyUser = () => {};
    const setters = {
        // Provide an inert set rushee stub for this test.
        setRushee: () => {},
        // Provide an inert set error stub for this test.
        setError: () => {},
        // Provide an inert set loading stub for this test.
        setLoading: () => {},
    };
    const hook = await loadTsxComponent(hookPath, {
        react: {
            // Expose controlled hook state and capture updates for assertions.
            useState: (initial) => [initial, /* Leave this mocked callback inert. */ () => {}],
            // Capture effects so the test can run them explicitly.
            useEffect: (effect) => effects.push(effect),
        },
        axios,
        "../../../firebase": { auth },
        "../../comments/commentVisibility": {
            getVisibleComments, hasOwnComment, shouldShowAllComments,
        },
        "../../auth/verifyUser": { verifyUser },
        "./loadRusheeZoom": { loadRusheeZoom: (deps) => {
            // Record load rushee zoom calls for assertions.
             requests.push(deps); } },
    });
    const args = {
        loading: true,
        // Provide an inert navigate stub for this test.
        navigate: () => {},
        errorTitle: "title",
        errorDescription: "description",
        api: "/api",
        gtid: "123",
        rushee: null,
        user: null,
        ...setters,
    };

    const access = hook(args);
    assert.equal(access.requireCommentToView, true);
    assert.equal(access.showAllComments, false);
    assert.equal(access.userHasOwnComment, false);
    assert.equal(access.visibleComments.length, 0);

    effects[0]();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].auth, auth);
    assert.equal(requests[0].axios, axios);
    assert.equal(requests[0].verifyUser, verifyUser);
    assert.equal(requests[0].setRushee, setters.setRushee);
    assert.equal(requests[0].setError, setters.setError);
    assert.equal(requests[0].setLoading, setters.setLoading);
    assert.equal(requests[0].gtid, "123");

    hook({ ...args, loading: false });
    effects[1]();
    assert.equal(requests.length, 1);
});
